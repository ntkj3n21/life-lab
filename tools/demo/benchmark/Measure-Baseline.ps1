[CmdletBinding()]
param(
    [string]$BaseUrl = 'http://localhost:8080',
    [string]$EnvFile,
    [ValidateRange(1, 100)][int]$Warmups = 3,
    [ValidateRange(2, 100)][int]$Runs = 15
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if ([string]::IsNullOrWhiteSpace($EnvFile)) {
    $EnvFile = Join-Path $PSScriptRoot '../../../.env'
}
. (Join-Path $PSScriptRoot '../../a2/A2-Database.ps1')
$database = Get-A2DatabaseConfig -EnvFile $EnvFile
$snapshotText = @(Invoke-A2Psql -DatabaseConfig $database -Capture -Arguments @(
    '-At', '-f', (Join-Path $PSScriptRoot 'expected.sql')
)) -join ''
$snapshot = $snapshotText | ConvertFrom-Json
$counts = $snapshot.counts
if ($counts.notes_plain -ne 1500 -or $counts.tasks_plain -ne 1500 -or
    $counts.notes_common -ne 662 -or $counts.notes_medium -ne 165 -or
    $counts.notes_rare -ne 10 -or $counts.notes_none -ne 0 -or
    $counts.tasks_common -ne 662 -or $counts.tasks_medium -ne 165 -or
    $counts.tasks_rare -ne 10 -or $counts.tasks_none -ne 0) {
    throw 'The 1,500/1,500 fixture or deterministic marker counts do not match the required baseline.'
}
if ($snapshot.accountIds.demo -eq $snapshot.accountIds.a1 -or
    $snapshot.accountIds.demo -eq $snapshot.accountIds.a2 -or
    $snapshot.accountIds.a1 -eq $snapshot.accountIds.a2 -or
    $null -eq $snapshot.categoryId -or $null -eq $snapshot.tagId -or
    [string]::IsNullOrWhiteSpace($snapshot.videoQuery) -or
    [string]::IsNullOrWhiteSpace($snapshot.imageQuery) -or
    [string]::IsNullOrWhiteSpace($snapshot.audioQuery)) {
    throw 'The benchmark account, organization IDs, or Library search queries are unavailable.'
}
if ($counts.notes_combined -lt 1 -or $counts.tasks_combined -lt 1) {
    throw 'The selected combined organization filters did not match seeded Notes and Tasks.'
}

function New-IdSet([object[]]$Values) {
    $set = New-Object 'System.Collections.Generic.HashSet[string]'
    foreach ($value in $Values) { [void]$set.Add([string]$value) }
    return ,$set
}
$owned = @{
    notes = New-IdSet $snapshot.noteIds
    tasks = New-IdSet $snapshot.taskIds
    video = New-IdSet $snapshot.videoIds
    image = New-IdSet $snapshot.imageIds
    audio = New-IdSet $snapshot.audioIds
}
$searchIds = @{
    video = New-IdSet $snapshot.videoSearchIds
    image = New-IdSet $snapshot.imageSearchIds
    audio = New-IdSet $snapshot.audioSearchIds
}

function New-Session([string]$Email) {
    $session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
    $csrf = Invoke-RestMethod -Uri "$BaseUrl/api/auth/csrf" -WebSession $session -TimeoutSec 10
    $headers = @{ $csrf.headerName = $csrf.token }
    $body = @{ email = $Email; password = 'LifeLab@2026' } | ConvertTo-Json -Compress
    Invoke-RestMethod -Uri "$BaseUrl/api/auth/login" -Method Post -ContentType 'application/json' `
        -Body $body -Headers $headers -WebSession $session -TimeoutSec 10 | Out-Null
    return $session
}

function Get-Json([string]$Path, $Session) {
    return Invoke-RestMethod -Uri "$BaseUrl$Path" -WebSession $Session -TimeoutSec 30
}

$demoSession = New-Session 'scale-demo@lifelab.local'
$otherSessions = @{
    a1 = New-Session 'demo@lifelab.local'
    a2 = New-Session 'scale@lifelab.local'
}
$isolation = @()
foreach ($account in @('a1', 'a2')) {
    foreach ($domain in @('notes', 'tasks')) {
        $body = Get-Json "/api/${domain}?page=0&size=20" $otherSessions[$account]
        $expected = [int]$counts."${account}_$domain"
        $allowed = New-IdSet $snapshot."${account}$(if ($domain -eq 'notes') { 'Note' } else { 'Task' })Ids"
        $leaked = @($body.items | Where-Object { -not $allowed.Contains([string]$_.id) }).Count
        $isolation += [pscustomobject]@{ account = $account; domain = $domain; expected = $expected; actual = $body.totalElements; leakedFirstPage = $leaked }
        if ($body.totalElements -ne $expected -or $leaked -ne 0) {
            throw "Account isolation preflight failed for $account $domain."
        }
    }
}

function Encode([string]$Value) { return [uri]::EscapeDataString($Value) }
$categoryId = $snapshot.categoryId
$tagId = $snapshot.tagId
$videoQ = Encode $snapshot.videoQuery
$imageQ = Encode $snapshot.imageQuery
$audioQ = Encode $snapshot.audioQuery
$cases = @(
    [pscustomobject]@{ name='notes_plain'; path='/api/notes?page=0&size=20'; kind='notes'; expected='notes_plain'; check='' }
    [pscustomobject]@{ name='notes_common'; path='/api/notes?page=0&size=20&q=checkpoint'; kind='notes'; expected='notes_common'; check='checkpoint' }
    [pscustomobject]@{ name='notes_medium'; path='/api/notes?page=0&size=20&q=tradeoff'; kind='notes'; expected='notes_medium'; check='tradeoff' }
    [pscustomobject]@{ name='notes_rare'; path='/api/notes?page=0&size=20&q=quorum'; kind='notes'; expected='notes_rare'; check='quorum' }
    [pscustomobject]@{ name='notes_none'; path='/api/notes?page=0&size=20&q=xyznomatch'; kind='notes'; expected='notes_none'; check='xyznomatch' }
    [pscustomobject]@{ name='notes_category'; path="/api/notes?page=0&size=20&categoryId=$categoryId"; kind='notes'; expected='notes_category'; check='category' }
    [pscustomobject]@{ name='notes_tag'; path="/api/notes?page=0&size=20&tagId=$tagId"; kind='notes'; expected='notes_tag'; check='tag' }
    [pscustomobject]@{ name='notes_timestamp'; path='/api/notes?page=0&size=20&hasTimestamp=true'; kind='notes'; expected='notes_timestamp'; check='timestamp' }
    [pscustomobject]@{ name='notes_combined'; path="/api/notes?page=0&size=20&q=checkpoint&categoryId=$categoryId&tagId=$tagId"; kind='notes'; expected='notes_combined'; check='note_combined' }
    [pscustomobject]@{ name='notes_later_page'; path='/api/notes?page=10&size=20'; kind='notes'; expected='notes_plain'; check='later' }
    [pscustomobject]@{ name='tasks_plain'; path='/api/tasks?page=0&size=20'; kind='tasks'; expected='tasks_plain'; check='' }
    [pscustomobject]@{ name='tasks_common'; path='/api/tasks?page=0&size=20&q=checkpoint'; kind='tasks'; expected='tasks_common'; check='checkpoint' }
    [pscustomobject]@{ name='tasks_medium'; path='/api/tasks?page=0&size=20&q=tradeoff'; kind='tasks'; expected='tasks_medium'; check='tradeoff' }
    [pscustomobject]@{ name='tasks_rare'; path='/api/tasks?page=0&size=20&q=quorum'; kind='tasks'; expected='tasks_rare'; check='quorum' }
    [pscustomobject]@{ name='tasks_none'; path='/api/tasks?page=0&size=20&q=xyznomatch'; kind='tasks'; expected='tasks_none'; check='xyznomatch' }
    [pscustomobject]@{ name='tasks_status'; path='/api/tasks?page=0&size=20&status=IN_PROGRESS'; kind='tasks'; expected='tasks_status'; check='status' }
    [pscustomobject]@{ name='tasks_deadline'; path='/api/tasks?page=0&size=20&deadlineFrom=2026-09-21&deadlineTo=2026-09-27'; kind='tasks'; expected='tasks_deadline'; check='deadline' }
    [pscustomobject]@{ name='tasks_category'; path="/api/tasks?page=0&size=20&categoryId=$categoryId"; kind='tasks'; expected='tasks_category'; check='category' }
    [pscustomobject]@{ name='tasks_tag'; path="/api/tasks?page=0&size=20&tagId=$tagId"; kind='tasks'; expected='tasks_tag'; check='tag' }
    [pscustomobject]@{ name='tasks_source'; path='/api/tasks?page=0&size=20&sourceStatus=SOURCE_MISSING'; kind='tasks'; expected='tasks_source'; check='source' }
    [pscustomobject]@{ name='tasks_combined'; path="/api/tasks?page=0&size=20&q=checkpoint&status=NOT_STARTED&categoryId=$categoryId"; kind='tasks'; expected='tasks_combined'; check='task_combined' }
    [pscustomobject]@{ name='tasks_later_page'; path='/api/tasks?page=10&size=20'; kind='tasks'; expected='tasks_plain'; check='later' }
    [pscustomobject]@{ name='video_plain'; path='/api/library/videos?page=0&size=20'; kind='video'; expected='video_plain'; check='' }
    [pscustomobject]@{ name='video_search'; path="/api/library/videos?page=0&size=20&q=$videoQ"; kind='video'; expected='video_search'; check='video_search' }
    [pscustomobject]@{ name='video_filter_sort'; path='/api/library/videos?page=0&size=20&watched=true&sortBy=viewCount&sortDirection=desc'; kind='video'; expected='video_watched'; check='video_watched' }
    [pscustomobject]@{ name='image_plain'; path='/api/library/images?page=0&size=20'; kind='image'; expected='image_plain'; check='' }
    [pscustomobject]@{ name='image_search'; path="/api/library/images?page=0&size=20&q=$imageQ"; kind='image'; expected='image_search'; check='image_search' }
    [pscustomobject]@{ name='audio_plain'; path='/api/library/audio?page=0&size=20'; kind='audio'; expected='audio_plain'; check='' }
    [pscustomobject]@{ name='audio_search'; path="/api/library/audio?page=0&size=20&q=$audioQ"; kind='audio'; expected='audio_search'; check='audio_search' }
    [pscustomobject]@{ name='daily_plan'; path='/api/plan'; kind='plan'; expected='plan'; check='' }
)

$firstIds = @{}
function Test-Result($Case, $Body) {
    if ($Case.kind -eq 'plan') {
        if ([string]$Body.currentDate -ne [string]$snapshot.localDate -or $Body.timeZone -ne 'Asia/Ho_Chi_Minh') {
            return "date/timezone mismatch: $($Body.currentDate), $($Body.timeZone)"
        }
        $all = @()
        foreach ($group in @('overdue','today','upcoming','noDeadline','completed')) {
            $actual = @($Body.$group).Count
            if ($actual -ne [int]$counts."plan_$(if ($group -eq 'noDeadline') { 'no_deadline' } else { $group })") {
                return "$group count=$actual, expected=$($counts."plan_$(if ($group -eq 'noDeadline') { 'no_deadline' } else { $group })")"
            }
            foreach ($task in @($Body.$group)) {
                if (-not $owned.tasks.Contains([string]$task.id)) { return "foreign Task ID $($task.id)" }
                $deadline = if ($null -eq $task.deadline) { $null } else { [datetime]::Parse($task.deadline) }
                $today = [datetime]::Parse($snapshot.localDate)
                $valid = switch ($group) {
                    'completed' { $task.status -eq 'COMPLETED' }
                    'noDeadline' { $task.status -ne 'COMPLETED' -and $null -eq $deadline }
                    'today' { $task.status -ne 'COMPLETED' -and $deadline -eq $today }
                    'overdue' { $task.status -ne 'COMPLETED' -and $deadline -lt $today }
                    'upcoming' { $task.status -ne 'COMPLETED' -and $deadline -gt $today }
                }
                if (-not $valid) { return "incorrect $group assignment for Task $($task.id)" }
                $all += [string]$task.id
            }
        }
        if ($all.Count -ne 1500 -or @(($all | Select-Object -Unique)).Count -ne 1500) {
            return 'Daily Plan is not an exact partition of 1,500 demo Tasks.'
        }
        return ''
    }
    $expectedTotal = [int]$counts.($Case.expected)
    $page = if ($Case.check -eq 'later') { 10 } else { 0 }
    $expectedItems = [math]::Max(0, [math]::Min(20, $expectedTotal - $page * 20))
    if ($Body.page -ne $page -or $Body.size -ne 20 -or
        $Body.totalElements -ne $expectedTotal -or
        $Body.totalPages -ne [math]::Ceiling($expectedTotal / 20.0) -or
        @($Body.items).Count -ne $expectedItems) {
        return "page metadata/count mismatch: page=$($Body.page), size=$($Body.size), total=$($Body.totalElements), pages=$($Body.totalPages), items=$(@($Body.items).Count); expected total=$expectedTotal items=$expectedItems"
    }
    $ids = @()
    $previousSort = $null
    foreach ($item in @($Body.items)) {
        $id = [string]$item.id
        if (-not $owned[$Case.kind].Contains($id)) { return "foreign $($Case.kind) ID $id" }
        $ids += $id
        $haystack = if ($Case.kind -eq 'notes') { [string]$item.content }
            elseif ($Case.kind -eq 'tasks') { "$($item.title) $($item.description)" }
            else { '' }
        switch ($Case.check) {
            { $_ -in 'checkpoint','tradeoff','quorum','xyznomatch' } {
                if ($haystack.IndexOf($Case.check, [StringComparison]::OrdinalIgnoreCase) -lt 0) { return "search mismatch for ID $id" }
            }
            'category' { if ($item.category.id -ne $categoryId) { return "Category mismatch for ID $id" } }
            'tag' { if (@($item.tags | Where-Object { $_.id -eq $tagId }).Count -eq 0) { return "Tag mismatch for ID $id" } }
            'timestamp' { if ($null -eq $item.timestampSeconds) { return "timestamp missing for ID $id" } }
            'note_combined' {
                if ($item.category.id -ne $categoryId -or @($item.tags | Where-Object { $_.id -eq $tagId }).Count -eq 0 -or
                    $haystack.IndexOf('checkpoint', [StringComparison]::OrdinalIgnoreCase) -lt 0) { return "combined filter mismatch for ID $id" }
            }
            'status' { if ($item.status -ne 'IN_PROGRESS') { return "status mismatch for ID $id" } }
            'deadline' { if ($null -eq $item.deadline -or $item.deadline -lt '2026-09-21' -or $item.deadline -gt '2026-09-27') { return "deadline mismatch for ID $id" } }
            'source' { if ($item.sourceStatus -ne 'SOURCE_MISSING') { return "source status mismatch for ID $id" } }
            'task_combined' {
                if ($item.status -ne 'NOT_STARTED' -or $item.category.id -ne $categoryId -or
                    $haystack.IndexOf('checkpoint', [StringComparison]::OrdinalIgnoreCase) -lt 0) { return "combined filter mismatch for ID $id" }
            }
            'video_search' {
                if (-not $searchIds.video.Contains($id)) { return "Video search mismatch for ID $id" }
            }
            'video_watched' { if (-not $item.watched -or $item.viewCount -lt 1) { return "watched filter mismatch for ID $id" } }
            'image_search' { if (-not $searchIds.image.Contains($id)) { return "Image search mismatch for ID $id" } }
            'audio_search' { if (-not $searchIds.audio.Contains($id)) { return "Audio search mismatch for ID $id" } }
            'later' {
                $firstKey = if ($Case.kind -eq 'notes') { 'notes' } else { 'tasks' }
                if ($firstIds.ContainsKey($firstKey) -and $firstIds[$firstKey] -contains $id) { return "later page overlaps first page at ID $id" }
            }
        }
        $sortValue = if ($Case.check -eq 'video_watched') { [long]$item.viewCount }
            elseif ($Case.kind -in 'notes','tasks') { [datetimeoffset]::Parse($item.createdAt) }
            else { [datetimeoffset]::Parse($item.addedAt) }
        if ($null -ne $previousSort -and $sortValue -gt $previousSort) { return "sort order mismatch at ID $id" }
        $previousSort = $sortValue
    }
    if (@($ids | Select-Object -Unique).Count -ne $ids.Count) { return 'Duplicate IDs on page.' }
    if ($Case.name -in 'notes_plain','tasks_plain') { $firstIds[$Case.kind] = $ids }
    return ''
}

$started = (Get-Date).ToUniversalTime()
$samples = New-Object 'System.Collections.Generic.List[object]'
$summaries = New-Object 'System.Collections.Generic.List[object]'
foreach ($case in $cases) {
    for ($iteration = 1; $iteration -le ($Warmups + $Runs); $iteration++) {
        $phase = if ($iteration -le $Warmups) { 'warmup' } else { 'measured' }
        $run = if ($phase -eq 'warmup') { $iteration } else { $iteration - $Warmups }
        $timer = [Diagnostics.Stopwatch]::StartNew()
        $status = 0
        $content = $null
        $failure = ''
        try {
            $headers = if ($case.kind -eq 'plan') { @{ 'X-Time-Zone' = 'Asia/Ho_Chi_Minh' } } else { @{} }
            $response = Invoke-WebRequest -UseBasicParsing -Uri "$BaseUrl$($case.path)" `
                -WebSession $demoSession -Headers $headers -TimeoutSec 60
            $timer.Stop()
            $status = [int]$response.StatusCode
            $content = $response.Content
        } catch {
            $timer.Stop()
            $failure = $_.Exception.Message
            if ($_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode }
        }
        $actual = ''
        if ($status -eq 200) {
            try {
                $body = $content | ConvertFrom-Json
                $failure = Test-Result $case $body
                $actual = if ($case.kind -eq 'plan') {
                    "overdue=$(@($body.overdue).Count);today=$(@($body.today).Count);upcoming=$(@($body.upcoming).Count);noDeadline=$(@($body.noDeadline).Count);completed=$(@($body.completed).Count)"
                } else { "total=$($body.totalElements);items=$(@($body.items).Count)" }
            } catch { $failure = "JSON/validation error: $($_.Exception.Message)" }
        } elseif (-not $failure) { $failure = "HTTP $status" }
        $samples.Add([pscustomobject]@{
            workload=$case.name; phase=$phase; run=$run; elapsedMs=[math]::Round($timer.Elapsed.TotalMilliseconds,3)
            httpStatus=$status; correct=[string]::IsNullOrEmpty($failure); actual=$actual; failure=$failure
        })
    }
    $measured = @($samples | Where-Object { $_.workload -eq $case.name -and $_.phase -eq 'measured' })
    $bad = @($measured | Where-Object { -not $_.correct })
    $httpErrors = @($measured | Where-Object { $_.httpStatus -ne 200 })
    $sorted = @($measured | ForEach-Object { $_.elapsedMs } | Sort-Object)
    $p50 = if ($bad.Count -eq 0) { [math]::Round(($sorted[[math]::Ceiling($Runs * 0.50)-1]), 3) } else { $null }
    $p95 = if ($bad.Count -eq 0) { [math]::Round(($sorted[[math]::Ceiling($Runs * 0.95)-1]), 3) } else { $null }
    $expected = if ($case.kind -eq 'plan') {
        "overdue=$($counts.plan_overdue);today=$($counts.plan_today);upcoming=$($counts.plan_upcoming);noDeadline=$($counts.plan_no_deadline);completed=$($counts.plan_completed)"
    } else { [string]$counts.($case.expected) }
    $summaries.Add([pscustomobject]@{
        workload=$case.name; endpoint=$case.path; expected=$expected; actual=$measured[-1].actual
        warmups=$Warmups; runs=$Runs; correctness=if ($bad.Count -eq 0) { 'PASS' } else { 'FAIL' }
        correctnessFailures=$bad.Count; p50Ms=$p50; p95Ms=$p95
        errorRatePct=[math]::Round(100.0 * $httpErrors.Count / $Runs, 2)
        failure=if ($bad.Count -gt 0) { $bad[0].failure } else { '' }
    })
    Write-Host "$($case.name): $($summaries[-1].correctness), p50=$p50 ms, p95=$p95 ms"
}

$stamp = $started.ToString('yyyyMMdd-HHmmss')
$prefix = Join-Path $PSScriptRoot "baseline-1500-1500-$stamp"
$samples | Export-Csv -LiteralPath "$prefix-samples.csv" -NoTypeInformation -Encoding UTF8
$summaries | Export-Csv -LiteralPath "$prefix-summary.csv" -NoTypeInformation -Encoding UTF8
$os = [Environment]::OSVersion.VersionString
$lines = New-Object 'System.Collections.Generic.List[string]'
$lines.Add('# Life Lab API baseline — 1,500 Notes / 1,500 Tasks')
$lines.Add('')
$lines.Add("- UTC start: $($started.ToString('yyyy-MM-dd HH:mm:ss'))")
$lines.Add("- Demo account: scale-demo@lifelab.local; ReferenceDate: $($snapshot.referenceDate); Daily Plan timezone/date: Asia/Ho_Chi_Minh / $($snapshot.localDate)")
$lines.Add("- Organization filter sample: Category $($snapshot.categoryName) (ID $categoryId), Tag $($snapshot.tagName) (ID $tagId), selected by read-only seeded-row match.")
$lines.Add("- Environment: $os; PowerShell $($PSVersionTable.PSVersion); API $BaseUrl; PostgreSQL via local demo fixture; sequential requests, one authenticated session, no artificial concurrency.")
$lines.Add("- Method: HTTP GET via Invoke-WebRequest; stopwatch covers client request/response transfer, not JSON parsing/correctness checks. $Warmups warm-ups and $Runs measured requests per case; nearest-rank p50/p95. Error rate = non-200/network failures divided by measured runs. A correctness failure suppresses that case's latency percentiles.")
$lines.Add('- Source-type Note filter omitted: current `/api/notes` has no such query parameter. SQL below is read-only correctness evidence, never a latency substitute.')
$lines.Add("- Read-only fixture verifier: 1,500 Notes, 1,500 Tasks; search counts for both domains: checkpoint 662, tradeoff 165, quorum 10, xyznomatch 0. A1/A2 accounts have different IDs and were checked via authenticated page requests.")
$lines.Add('')
$lines.Add('## Results')
$lines.Add('')
$lines.Add('| Workload | API path/query | Expected | Actual | Correct | p50 ms | p95 ms | HTTP error % |')
$lines.Add('|---|---|---:|---:|---|---:|---:|---:|')
foreach ($row in $summaries) {
    $lines.Add("| $($row.workload) | ``$($row.endpoint)`` | $($row.expected) | $($row.actual) | $($row.correctness) | $($row.p50Ms) | $($row.p95Ms) | $($row.errorRatePct) |")
}
$lines.Add('')
$lines.Add('## Correctness and limitations')
$lines.Add('')
$lines.Add("- SQL expected counts were computed before measurement from the demo account, and every returned ID was checked against its account-owned ID set. All page metadata, relevant item predicates, sort direction, and Daily Plan grouping/partition were checked per response. Later pages were checked for non-overlap with page 0.")
$lines.Add("- A1/A2 isolation preflight: $(($isolation | ForEach-Object { "$($_.account) $($_.domain) $($_.actual)/$($_.expected), leaked first-page IDs=$($_.leakedFirstPage)" }) -join '; ').")
foreach ($row in @($summaries | Where-Object { $_.correctness -eq 'FAIL' })) {
    $lines.Add("- **$($row.workload) failed correctness:** $($row.failure)")
}
$lines.Add('- Single local Windows/JVM/PostgreSQL environment; client-side timings include local HTTP and PowerShell overhead. This is a reproducible baseline, not a throughput or scalability claim. No 5,000/5,000 profile was run.')
$lines.Add("- Raw samples: [$(Split-Path -Leaf "$prefix-samples.csv")]($(Split-Path -Leaf "$prefix-samples.csv")); structured summary: [$(Split-Path -Leaf "$prefix-summary.csv")]($(Split-Path -Leaf "$prefix-summary.csv")).")
$lines | Set-Content -LiteralPath "$prefix.md" -Encoding UTF8
Write-Host "Evidence: $prefix.md"
