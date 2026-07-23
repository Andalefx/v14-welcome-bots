const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource } = require('@discordjs/voice');
const path = require('path');

// --- AYARLAR ---
const YETKILI_ROL_ID = "";
const SUNUCU_ID = ""; 
const KOMUT_PREFIX = "!";

let AKTIF_MOD = "hosgeldin";

const SES_DOSYALARI = {
    yetkili: path.join(__dirname, 'yetkili.mp3'),
    cekilis: path.join(__dirname, 'cekilis.mp3'),
    cuma: path.join(__dirname, 'cuma.mp3'),
    hosgeldin: path.join(__dirname, 'hosgeldin.mp3'),
    konser: path.join(__dirname, 'konser.mp3'),
    taglialim: path.join(__dirname, 'taglialim.mp3'),
    toplanti: path.join(__dirname, 'toplanti.mp3'),
    turnuva: path.join(__dirname, 'turnuva.mp3')
};

const BOT_CONFIGS = [
    { channelId: "", token: "" },
    { channelId: "", token: "" },
    { channelId: "", token: "" },
    { channelId: "", token: "" },
    { channelId: "", token: "" }
];

const allClients = [];

function playSound(connection, filePath, botName) {
    const player = createAudioPlayer();
    const resource = createAudioResource(filePath);
    
    player.play(resource);
    connection.subscribe(player);

    player.on('error', error => {
        console.error(`[${botName}] Ses oynatılırken hata oluştu: ${error.message}`);
    });
}

async function botlariSiraylaBaslat() {
    for (let index = 0; index < BOT_CONFIGS.length; index++) {
        const config = BOT_CONFIGS[index];
        
        const client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildVoiceStates,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent
            ]
        });

        allClients.push(client);

        client.on('clientReady', async () => {
            console.log(`[${client.user.tag}] Aktif ve hazır!`);
            client.user.setActivity(`${AKTIF_MOD.toUpperCase()} Modu`, { type: 2 });
            
            try {
                const guild = client.guilds.cache.get(SUNUCU_ID) || await client.guilds.fetch(SUNUCU_ID);
                
                if (guild) {
                    // DÜZELTME: Her bot için benzersiz bir 'group' (oturum grubu) tanımlıyoruz.
                    // Böylece botların ses bağlantıları birbirine karışmaz.
                    joinVoiceChannel({
                        channelId: config.channelId,
                        guildId: guild.id,
                        adapterCreator: guild.voiceAdapterCreator,
                        group: client.user.id // <-- Çakışmayı çözen kritik satır
                    });
                    console.log(`[${client.user.username}] Başarıyla ses kanalına bağlandı.`);
                }
            } catch (err) {
                console.error(`[${client.user.username}] Sunucu bağlantısı veya kanala giriş başarısız:`, err.message);
            }
        });

        client.on('voiceStateUpdate', async (oldState, newState) => {
            if (newState.member.user.bot) return;

            if (newState.channelId === config.channelId && oldState.channelId !== newState.channelId) {
                const member = newState.member;
                const guild = newState.guild;

                try {
                    // DÜZELTME: Buradaki ses tetiklenmesine de group parametresi eklendi
                    const connection = joinVoiceChannel({
                        channelId: config.channelId,
                        guildId: guild.id,
                        adapterCreator: guild.voiceAdapterCreator,
                        group: client.user.id 
                    });

                    const isYetkili = member.roles.cache.has(YETKILI_ROL_ID);

                    if (isYetkili) {
                        console.log(`[${client.user.username}] Yetkili girdi! Yetkili sesi çalınıyor.`);
                        playSound(connection, SES_DOSYALARI.yetkili, client.user.username);
                    } else {
                        console.log(`[${client.user.username}] Kullanıcı girdi. Mod: ${AKTIF_MOD}`);
                        playSound(connection, SES_DOSYALARI[AKTIF_MOD], client.user.username);
                    }
                } catch (error) {
                    console.error(`[${client.user.username}] Giriş tetiklenmesinde ses hatası:`, error.message);
                }
            }
        });

        if (index === 0) {
            client.on('messageCreate', async (message) => {
                if (!message.content.startsWith(KOMUT_PREFIX) || message.author.bot) return;

                const args = message.content.slice(KOMUT_PREFIX.length).trim().split(/\s+/);
                const command = args.shift().toLowerCase();

                if (command === 'mod') {
                    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                        return message.reply("❌ Bu komutu sadece yöneticiler kullanabilir.");
                    }

                    const yeniMod = args[0]?.toLowerCase();

                    if (yeniMod && SES_DOSYALARI[yeniMod] && yeniMod !== 'yetkili') {
                        AKTIF_MOD = yeniMod;
                        
                        allClients.forEach(c => {
                            if (c.user) { 
                                c.user.setActivity(`${yeniMod.toUpperCase()} Modu`, { type: 2 }); 
                            }
                        });
                        return message.reply(`🔊 Ses modu başarıyla değiştirildi: **${yeniMod.toUpperCase()}**`);
                    } else {
                        return message.reply("❌ Geçersiz mod! Seçenekler: `cekilis`, `cuma`, `hosgeldin`, `konser`, `taglialim`, `toplanti`, `turnuva`");
                    }
                }
            });
        }

        await client.login(config.token);

        if (index < BOT_CONFIGS.length - 1) {
            console.log(`[Sistem] Diğer botun giriş yapması için 2 saniye bekleniyor...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
}

botlariSiraylaBaslat();