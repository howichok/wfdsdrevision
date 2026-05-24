"use client";

/**
 * Thin client wrapper so the dashboard Server Component can include
 * the ActiveDrafts hub (which needs client-side Zustand) without
 * converting the entire page to a client component.
 */
export { default } from "./ActiveDrafts";
