"use client";

import { useEffect } from "react";
import { getDriveController } from "@/features/drive/driveController";

/** Liga o backup automático do Google Drive (agrupado, com pendência offline). Não renderiza nada. */
export default function DriveAutoBackup() {
  useEffect(() => { try { getDriveController().start(); } catch { /* sem IndexedDB: o resto do app mostra o erro */ } }, []);
  return null;
}
