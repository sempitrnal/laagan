const webPush = require("web-push");

const vapidKeys = webPush.generateVAPIDKeys();

console.log("Add these to your .env.local file:\n");
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`);
console.log(`VAPID_SUBJECT=mailto:your-email@example.com`);
console.log("\nReplace the email with your own contact email.");
