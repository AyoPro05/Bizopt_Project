"use client";

import { createContext, useContext, useState } from "react";

type WorkspaceContextValue = {
  sessionId: string | null;
  setSessionId: (sessionId: string | null) => void;
  stage: string;
  setStage: (stage: string) => void;
  ideaPrompt: string;
  setIdeaPrompt: (prompt: string) => void;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [stage, setStage] = useState("idea");
  const [ideaPrompt, setIdeaPrompt] = useState("");

  return (
    <WorkspaceContext.Provider
      value={{
        sessionId,
        setSessionId,
        stage,
        setStage,
        ideaPrompt,
        setIdeaPrompt,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspaceSession() {
  const context = useContext(WorkspaceContext);

  if (!context) {
    throw new Error("useWorkspaceSession must be used inside WorkspaceProvider");
  }

  return context;
}
