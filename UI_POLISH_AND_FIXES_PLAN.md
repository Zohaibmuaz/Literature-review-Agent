# UI Polish & Bug Fixes Plan

This document tracks the issues reported during the UI/UX review. We will fix these **one feature at a time** to ensure maximum quality and stability.

## Phase 1: Left Sidebar (Multi-Agent Tracker) Improvements
*Goal: Make the tracking nodes feel alive, dynamic, and visually appealing.*
- [x] **1.1 Add Node Animations:** Add pulsing, spinning, or transition animations to the 3 agent nodes so it is visually obvious when they are actively working (instead of just statically changing text to "Live").
- [x] **1.2 Smooth Accordion Interactions:** Improve the expand/collapse click interaction so it feels smooth and less rigid/static.
- [x] **1.3 Fix Color Contrast:** Change the color of the paper source text (e.g., "arxiv") in the fetched papers list. Currently, it is dark grey on a black background, making it dull and hard to read.

## Phase 2: Main Editor & Scrolling Issues
*Goal: Fix layout bugs, visibility issues, and make the writing process more engaging.*
- [x] **2.1 Remove Weird Scroll Separator:** Remove the ugly scrollbar/element separating the left sidebar and the main writing area.
- [x] **2.2 Fix Cut-off Text at Bottom:** Fix the main editor's scroll height so the last 2-4 lines of generated text are fully visible and not hidden behind the bottom bar.
- [x] **2.3 Improve "AI is writing..." Visibility:** Move or redesign the "AI is writing" indicator so the user knows text is being generated without having to manually scroll all the way to the bottom.
- [x] **2.4 Enhance Writing Area Aesthetics:** Make the center paper area feel less static and more like a live document.

## Phase 3: Top Navbar & Toolbar Fixes
*Goal: Fix broken buttons, clean up the UI, and improve inputs.*
- [x] **3.1 Fix Theme Toggle:** Fix the Dark/Light mode toggle button so it actually switches themes properly (currently stuck on dark background).
- [x] **3.2 Clean up Export Toolbar:** Remove the 3 extra icon buttons to the left of the "Export" button.
- [x] **3.3 Implement Export Dropdown:** Change the "Export" button so that clicking it opens a dropdown with two options: "Download PDF" and "Download Word" (instead of instantly downloading the Word file).
- [x] **3.4 Wire up Formatting Toolbar:** Ensure the formatting toolbar (Bold, Heading, etc.) is either functional or visually clear on how it interacts with the markdown. (Removed the fake toolbar entirely to avoid user confusion and make the UI cleaner).
- [x] **3.5 Polish Input Fields:** Add subtle hover/focus states to the top input fields to make them feel less boring and static.
