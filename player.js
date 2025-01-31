import { joinVoiceChannel, createAudioPlayer, createAudioResource, entersState, AudioPlayerStatus } from '@discordjs/voice';
import ytdl from 'ytdl-core';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';

// Set FFmpeg path
ffmpeg.setFfmpegPath(ffmpegStatic);

export function setupPlayer(client, queue) {
  client.on('messageCreate', async message => {
    if (!message.content.startsWith('!') || message.author.bot) return;

    const args = message.content.slice(1).split(/ +/);
    const command = args.shift().toLowerCase();
    const guildId = message.guild.id;

    // !play <url>
    if (command === 'play') {
      execute(message, queue, args[0]);
    }
    
    // !skip
    if (command === 'skip') {
      skip(message, queue);
    }
    
    // !stop
    if (command === 'stop') {
      stop(message, queue);
    }
  });
}

async function execute(message, queue, url) {
  const voiceChannel = message.member.voice.channel;
  if (!voiceChannel) return message.reply('🚫 You need to be in a voice channel!');

  if (!url) return message.reply('🚫 Please provide a YouTube URL');
  if (!ytdl.validateURL(url)) return message.reply('🚫 Invalid YouTube URL');

  const songInfo = await ytdl.getInfo(url);
  const song = {
    title: songInfo.videoDetails.title,
    url: songInfo.videoDetails.video_url,
    duration: songInfo.videoDetails.lengthSeconds
  };

  const serverQueue = queue.get(message.guild.id);

  if (!serverQueue) {
    // Create queue if none exists
    const queueConstructor = {
      textChannel: message.channel,
      voiceChannel,
      connection: null,
      player: null,
      songs: [],
      playing: true
    };

    queue.set(message.guild.id, queueConstructor);
    queueConstructor.songs.push(song);

    try {
      const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: message.guild.id,
        adapterCreator: message.guild.voiceAdapterCreator,
      });

      const player = createAudioPlayer();
      queueConstructor.connection = connection;
      queueConstructor.player = player;

      play(message.guild, queueConstructor.songs[0], queue);
      message.channel.send(`🎵 Now playing: **${song.title}**`);
    } catch (error) {
      queue.delete(message.guild.id);
      console.error(error);
      message.channel.send('❌ Error connecting to voice channel');
    }
  } else {
    // Add to existing queue
    serverQueue.songs.push(song);
    message.channel.send(`✅ Added to queue: **${song.title}**`);
  }
}

function play(guild, song, queue) {
  const serverQueue = queue.get(guild.id);
  if (!song) {
    serverQueue.connection.destroy();
    queue.delete(guild.id);
    return;
  }

  const stream = ytdl(song.url, { filter: 'audioonly', highWaterMark: 1 << 25 });
  const resource = createAudioResource(stream);

  serverQueue.player.play(resource);
  serverQueue.connection.subscribe(serverQueue.player);

  serverQueue.player.on(AudioPlayerStatus.Idle, () => {
    serverQueue.songs.shift();
    play(guild, serverQueue.songs[0], queue);
  });

  serverQueue.player.on('error', error => {
    console.error('Player error:', error);
    serverQueue.textChannel.send('❌ Error playing audio');
  });
}

function skip(message, queue) {
  const serverQueue = queue.get(message.guild.id);
  if (!serverQueue) return message.channel.send('🚫 Nothing is playing');
  serverQueue.player.stop();
}

function stop(message, queue) {
  const serverQueue = queue.get(message.guild.id);
  if (!serverQueue) return message.channel.send('🚫 Nothing is playing');
  
  serverQueue.songs = [];
  serverQueue.player.stop();
  message.channel.send('⏹️ Stopped player and cleared queue');
}