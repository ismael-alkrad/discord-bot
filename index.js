require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const schedule = require('node-schedule');
const axios = require('axios');

const app = express();

const PORT = process.env.PORT || 3000;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates
    ]
});

// Store last move time to prevent rapid switching
const lastMoved = new Map();

client.once('ready', () => {
    console.log(`✅ Bot is online as ${client.user.tag}`);
});

app.get('/ping', (req, res) => {
    console.log(`🔄 Received keep-alive ping at ${new Date().toISOString()}`);
    res.status(200).send('Bot is alive');
});

schedule.scheduleJob('*/30 * * * * *', async () => {
    const endpoints = [
        { url: 'https://discord-bots-pnzd.onrender.com/ping', name: 'Discord Bots' },
        { url: 'https://myhome-realestate.onrender.com', name: 'MyHome Realestate' }
    ];

    for (const endpoint of endpoints) {
        try {
            await axios.get(endpoint.url);
            console.log(`✅ Successfully pinged ${endpoint.name}`);
        } catch (error) {
            console.error(`❌ Failed to ping ${endpoint.name}: ${error.message}`);
        }
    }
});



client.on('voiceStateUpdate', async (oldState, newState) => {
    const guild = client.guilds.cache.get(process.env.GUILD_ID);
    if (!guild) return;

    const streamRoomId = process.env.STREAM_ROOM_ID;
    const afkRoomId = process.env.AFK_ROOM_ID;
    const member = newState.member;

    if (!member || !member.voice.channelId) return;

    const now = Date.now();
    const lastMoveTime = lastMoved.get(member.id) || 0;

    // Prevent frequent switching within 5 seconds
    if (now - lastMoveTime < 5000) return;

    // Move user to AFK Room when they mute in Stream Room
    if (oldState.channelId === streamRoomId && newState.channelId === streamRoomId) {
        if (!oldState.selfMute && newState.selfMute) {
            console.log(`🎤 ${member.user.tag} muted the mic in Stream Room. Moving to AFK Room.`);
            try {
                await member.voice.setChannel(afkRoomId);
                lastMoved.set(member.id, now);
                console.log(`✅ ${member.user.tag} successfully moved to AFK Room.`);
            } catch (error) {
                console.error(`❌ Failed to move ${member.user.tag} to AFK Room:`, error);
            }
        }
    }

    // Move user to Stream Room when they unmute in AFK Room
    if (oldState.channelId === afkRoomId && newState.channelId === afkRoomId) {
        if (oldState.selfMute && !newState.selfMute) {
            console.log(`🎤 ${member.user.tag} unmuted the mic in AFK Room. Moving to Stream Room.`);
            try {
                await member.voice.setChannel(streamRoomId);
                lastMoved.set(member.id, now);
                console.log(`✅ ${member.user.tag} successfully moved to Stream Room.`);
            } catch (error) {
                console.error(`❌ Failed to move ${member.user.tag} to Stream Room:`, error);
            }
        }
    }
});

client.login(process.env.DISCORD_BOT_TOKEN);