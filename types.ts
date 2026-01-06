
export enum Language {
  HTML = 'html',
  CSS = 'css',
  JS = 'javascript',
  PYTHON = 'python'
}

export interface CodeFile {
  id: Language;
  name: string;
  content: string;
  language: string;
}

export interface AISuggestion {
  text: string;
  type: 'completion' | 'explanation' | 'fix';
}
