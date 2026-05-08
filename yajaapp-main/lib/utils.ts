import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function isIframe(): boolean {
  return typeof window !== "undefined" && window.self !== window.top
}

/**
 * Sanitiza nombres de archivo eliminando caracteres especiales
 * Convierte a minúsculas y reemplaza caracteres especiales con guiones
 * @param fileName - Nombre del archivo original (ej: "Mi Foto-Empresa.jpg")
 * @returns Nombre sanitizado sin extensión (ej: "mi-foto-empresa")
 */
export function sanitizeFileName(fileName: string): string {
  const nameWithoutExt = fileName
    .replace(/\.[^/.]+$/, '') // Remover extensión
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // Solo a-z, 0-9, guiones
    .replace(/^-+|-+$/g, ''); // Limpiar guiones inicio/final
  return nameWithoutExt || 'file'; // Fallback si queda vacío
}
