const { Client, GatewayIntentBits, Collection } = require('discord.js');
const express = require('express');
require('dotenv').config();

// --- เว็บเซิร์ฟเวอร์จำลองสำหรับ Render (Keep-Alive) ---
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('🤖 Anti-Spam Bot is running 24/7 successfully!');
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Web Server] เว็บเซิร์ฟเวอร์จำลองกำลังรันอยู่ที่พอร์ต ${PORT}`);
});
// -----------------------------------------------------------------

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent, // ต้องเปิดใน Discord Developer Portal ด้วย
        GatewayIntentBits.GuildModeration, // ต้องเปิดเพื่อใช้สิทธิ์เตะสมาชิก
    ],
});

// เก็บข้อมูลสแปม { userId: count } นับรวมทุกห้องเพื่อความชัวร์ว่าจะเตะแน่ๆ
const spamTracker = new Map();

// ค่ากำหนด: พิมพ์รัวๆ ครบ 5 ข้อความ จะโดนเตะทันที (ไม่จำกัดเวลา)
const LIMIT = 5; 
const ANNOUNCEMENT_CHANNEL_ID = '1462415081110503533';

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}! บอทพร้อมทำงานป้องกันสแปมแล้ว`);
});

client.on('messageCreate', async (message) => {
    // ข้ามข้อความของบอท หรือข้อความนอกเซิร์ฟเวอร์
    if (message.author.bot || !message.guild) return;

    const userId = message.author.id;
    const channelWhereSpammed = message.channel;

    // ดึงจำนวนข้อความเก่าของผู้ใช้ ถ้ายังไม่มีให้เริ่มที่ 0
    let currentCount = spamTracker.get(userId) || 0;
    currentCount += 1;
    spamTracker.set(userId, currentCount);

    console.log(`[Anti-Spam] ${message.author.tag} พิมพ์แล้ว ${currentCount}/${LIMIT} ข้อความ`);

    // ถ้าพิมพ์ครบ 5 ข้อความ
    if (currentCount >= LIMIT) {
        // ล้างค่าทันทีเพื่อป้องกันลูป
        spamTracker.delete(userId);

        try {
            const member = message.guild.members.cache.get(userId);

            // เช็กว่าเป็นเจ้าของเซิร์ฟเวอร์ไหม (เตะไม่ได้)
            if (message.guild.ownerId === userId) {
                console.log(`ไม่สามารถเตะ ${message.author.tag} ได้เนื่องจากเป็นเจ้าของเซิร์ฟเวอร์`);
                return;
            }

            // 1. สั่งเตะออกจากเซิร์ฟเวอร์
            if (member && member.kickable) {
                await member.kick('สแปมข้อความติดต่อกันเกินกำหนด');
                console.log(`[SUCCESS] เตะ ${message.author.tag} เรียบร้อยแล้ว!`);
            } else {
                console.log(`[ERROR] บอทไม่มีสิทธิ์เตะ ${message.author.tag} (กรุณาลากยศบอทขึ้นไปไว้เหนือยศของคนที่จะเทสในหน้าตั้งค่า Discord)`);
                return;
            }

            // 2. ส่งข้อความแจ้งเตือนไปที่ห้องประกาศ
            const announcementChannel = message.guild.channels.cache.get(ANNOUNCEMENT_CHANNEL_ID);
            if (announcementChannel) {
                await announcementChannel.send(
                    `🚨 **แจ้งเตือนการลงโทษ:** ผู้ใช้ <@${userId}> (${message.author.tag}) ถูกเตะออกจากเซิร์ฟเวอร์เนื่องจากพิมพ์ข้อความสแปมติดต่อกัน ${LIMIT} ข้อความรัวๆ ที่ห้อง <#${channelWhereSpammed.id}>`
                );
            }

        } catch (error) {
            console.error('เกิดข้อผิดพลาดในการเตะ:', error);
        }
    }
});

// รีเซ็ตจำนวนนับอัตโนมัติทุกๆ 6 วินาที ถ้าผู้ใช้หยุดพิมพ์ (กันไม่ให้สะสมยอดนานเกินไปจนเผลอโดนเตะทีหลัง)
setInterval(() => {
    spamTracker.clear();
}, 15000);

client.login(process.env.TOKEN);