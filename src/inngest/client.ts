import { Inngest } from "inngest";

// Create a client to send and receive events
export const inngest = new Inngest({ 
  id: "docmind", // Your app's ID
  isDev: true,   // ✅ Add this line to enable dev mode
});