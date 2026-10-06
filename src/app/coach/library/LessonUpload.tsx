"use client";
import { useState } from "react";
import { VideoUploader } from "@/components/VideoUploader";

export function LessonUpload() {
  const [open, setOpen] = useState(false);
  if (!open) return <button className="btn btn-primary self-start" onClick={() => setOpen(true)}>+ Upload lesson</button>;
  return <VideoUploader kind="lesson" onDone={() => setOpen(false)} onCancel={() => setOpen(false)} />;
}
