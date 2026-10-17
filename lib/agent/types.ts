/** Shared between the browser chat dock and the server-side agent. */
export interface AgentImage {
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';
  base64: string;
}
