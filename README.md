# Life Lab

Life Lab is a personal digital workspace designed to help users watch learning content, take contextual notes, manage tasks, and listen to music without constantly switching between applications.

> The project is currently under active development. Existing features may change as the architecture and user experience are improved.

## Overview

Life Lab combines media consumption and personal productivity in one workspace.

The current version focuses on a media-centered workflow:

1. Add and open a learning video.
2. Take notes linked to the current video and timestamp.
3. Create checklist-style tasks related to the current context.
4. Manage a personal video library.
5. Listen to music while working.
6. Preserve local data between browser sessions.

## Current Features

### Video workspace

* Add videos using a URL.
* Organize videos with titles and tags.
* Open videos inside the workspace.
* Edit or delete saved videos.
* Track the current video timestamp.
* Store the video library in the browser.

### Contextual notes

* Create notes while watching a video.
* Link notes to the active video.
* Save the timestamp at which a note was created.
* Edit and delete existing notes.
* Return to the related video context.

### Contextual todos

* Create todos linked to the active video.
* Convert multiline input into checklist items.
* Mark individual checklist items as completed.
* Mark an entire todo as completed.
* Edit and delete todos.

### Music player

* Add tracks using direct audio URLs.
* Save track titles and artist names.
* Play and pause audio.
* Move to the next or previous track.
* Select and delete tracks.
* Keep the music library in browser storage.

### Workspace layout

* Collapsible navigation sidebar.
* Context tools panel for notes and todos.
* Separate music player panel.
* Responsive dark workspace interface.

## Technology Stack

* React
* TypeScript
* Vite
* Tailwind CSS
* Zustand
* React Player
* Lucide React
* Nano ID
* Browser Local Storage

## Project Structure

```text
src/
├── components/
│   ├── context/
│   └── layout/
├── modules/
│   ├── media/
│   ├── notes/
│   └── todo/
├── stores/
├── types/
├── utils/
├── App.tsx
└── main.tsx
```

### Main directories

* `components/layout`: shared workspace layout and navigation components.
* `components/context`: components that display the current workspace context.
* `modules/media`: video library, video player, and media-related logic.
* `modules/notes`: contextual note components.
* `modules/todo`: checklist todo components.
* `stores`: Zustand stores for videos, notes, todos, music, layout, and context.
* `types`: shared TypeScript entities and interfaces.
* `utils`: reusable utility functions.

## Getting Started

### Requirements

* Node.js
* npm

### Installation

Clone the repository:

```bash
git clone https://github.com/ntkj3n21/life-lab.git
cd life-lab
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open the local URL displayed in the terminal.

## Available Scripts

```bash
npm run dev
```

Starts the Vite development server.

```bash
npm run lint
```

Checks the source code with ESLint.

```bash
npm run build
```

Runs the TypeScript build and creates a production build.

```bash
npm run preview
```

Previews the production build locally.

## Data Storage

The current version stores application data in browser `localStorage`.

This includes:

* Saved videos
* Notes
* Todos
* Music tracks

Because no backend is connected yet, data is stored separately in each browser and may be lost if browser storage is cleared.

## Current Limitations

* No user authentication.
* No backend or cloud synchronization.
* No database integration.
* No automated tests yet.
* Audio tracks require direct audio file URLs.
* Some navigation items are placeholders.
* Video URL validation is still limited.
* The interface is primarily optimized for desktop screens.

## Planned Development

* User authentication and personal accounts.
* Backend API and database persistence.
* Cloud synchronization across devices.
* Calendar and daily planning.
* Journal and personal reflection features.
* Improved media URL validation.
* Search and filtering across workspace entities.
* Keyboard command palette.
* Responsive mobile and tablet layouts.
* Automated testing.
* AI-assisted summaries and study notes.
* Speech-to-text support for learning videos.

## Project Status

Life Lab is an ongoing personal project and is not yet considered production-ready.

The current goal is to validate the core workflow:

```text
Video → Timestamp → Note or Todo → Return to Context
```

## Author

Developed by [ntkj3n21](https://github.com/ntkj3n21).
