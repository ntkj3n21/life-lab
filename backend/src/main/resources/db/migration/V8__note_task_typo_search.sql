CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;

-- Only a zero-result Notes/Tasks query calls this bounded, token-level fallback.
-- The outer query still applies account ownership and all selected filters.
CREATE FUNCTION lifelab_search_typo_near(value TEXT, keyword TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
PARALLEL SAFE
AS $$
    SELECT length(keyword) BETWEEN 4 AND 32
       AND keyword ~ '^[a-z0-9]+$'
       AND EXISTS (
           SELECT 1
           FROM regexp_split_to_table(lifelab_search_normalize(value), '[^a-z0-9]+') AS candidate(word)
           WHERE CASE
               WHEN length(candidate.word) BETWEEN 4 AND 32
                    AND left(candidate.word, 1) = left(keyword, 1)
                    AND abs(length(candidate.word) - length(keyword)) <= 1
               THEN levenshtein_less_equal(
                   candidate.word,
                   keyword,
                   CASE WHEN length(keyword) = 4 THEN 1 ELSE 2 END
               ) <= CASE WHEN length(keyword) = 4 THEN 1 ELSE 2 END
               ELSE FALSE
           END
       )
$$;
