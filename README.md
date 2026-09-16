# Homework Tracker

A sleek, dark-themed desktop app for tracking homework and assignments, built with Electron.

## Features

- Add homework with title, subject, due date, priority, and notes
- Custom subjects with color tags
- Tasks automatically grouped into Overdue, Due Today, This Week, Later, No Due Date, and Completed
- Filter by All / Pending / Overdue / Completed, search, and sort by due date, priority, subject, or newest
- Progress ring showing overall completion, plus quick stats (pending, overdue, due today, done)
- Data is saved locally on your machine (in the app's user data folder) — no account or internet needed

## Getting started

```bash
npm install
npm start
```

This launches the Electron app. Your homework data persists automatically between launches.

## Building a distributable

```bash
npm run dist
```

Produces a packaged app for your platform in `dist/` (via `electron-builder`).

## Project structure

```
src/
  main.js           Electron main process (window + local JSON persistence)
  preload.js         Secure bridge exposing load/save to the renderer
  renderer/
    index.html        App layout
    styles.css        Aesthetic dark/glassmorphic theme
    renderer.js        App state, rendering, and interactions
```
