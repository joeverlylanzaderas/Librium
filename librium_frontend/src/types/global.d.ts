// src/types/global.d.ts

declare module '@/global.css' {
  const content: any;
  export default content;
}

// Catches any alternative relative paths to CSS files
declare module '*.css';