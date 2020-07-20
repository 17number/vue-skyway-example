<!-- reference: https://github.com/skyway/skyway-js-sdk/tree/master/examples/p2p-media  -->
<template>
  <div class="room">
    <h2>Room (example)</h2>
    <div id="note">
      <p>
        Mode&nbsp;
        <a href="https://webrtc.ecl.ntt.com/skyway/overview.html#_4-sfu%E3%82%B5%E3%83%BC%E3%83%90" target="_blank" rel="noopener nofollow noreferrer">
          <span>[?]</span>
        </a>
      </p>
      <input type="radio" name="mode" id="mode_mesh" v-model="mode" value="mesh"><label for="mode_mesh">mesh</label>
      <input type="radio" name="mode" id="mode_sfu" v-model="mode" value="sfu"><label for="mode_sfu">sfu</label>
    </div>
    <div id="me">
      <h3>Source (You)</h3>
      <video
        id="my-video"
        width="400px"
        autoplay
        muted
        playsinline
        :srcObject.prop="stream"
        v-if="stream"
      />
      <!-- 接続オプション -->
      <div>
        <label>Video</label>
        <select v-model="selectedVideo" @change="resetVideo" v-if="videos.length > 0">
          <option :value="null" selected>なし</option>
          <option :value="video.deviceId" v-for="(video, i) in videos" :key="i">{{ video.label }}</option>
        </select>
      </div>
      <div>
        <label>Audio</label>
        <select v-model="selectedAudio" @change="resetVideo" v-if="audios.length > 0">
          <option :value="null" selected>なし</option>
          <option :value="audio.deviceId" v-for="(audio, i) in audios" :key="i">{{ audio.label }}</option>
        </select>
      </div>
      <!-- ミュート -->
      <div>
        <div>
          <label><input type="checkbox" v-model="mute.local.video" @change="muteMedia">Video を Off</label>
        </div>
        <div>
          <label><input type="checkbox" v-model="mute.local.audio" @change="muteMedia">Audio を Off</label>
        </div>
      </div>
    </div>
    <div id="room">
      <div>
        <label for="room-name">Room name</label>
        <input type="text" id="room-name" v-model="roomName">
        <button id="join" @click="join" v-if="!room">接続</button>
        <button id="close" @click="close" v-if="room">切断</button>
      </div>
      <h3>Room members</h3>
      <template v-for="(stream, i) in remoteStreams">
        <div :key="i">
          <video
            width="400px"
            autoplay
            playsinline
            :srcObject.prop="stream.stream"
            :data="{ peerId: stream.peerId }"
            :key="stream.peerId"
            data-remote-video
            v-if="peer.id !== stream.peerId"
          />
          <!-- ミュート -->
          <div>
            <div>
              <label><input type="checkbox" v-model="mute.remotes[stream.peerId].video" @change="muteMedia">Video を Off</label>
            </div>
            <div>
              <label><input type="checkbox" v-model="mute.remotes[stream.peerId].audio" @change="muteMedia">Audio を Off</label>
            </div>
          </div>
        </div>
      </template>
      <h4>Messages</h4>
      <div>
        <input type="text" v-model="message">
        <button type="button" @click="onDataSend">送信</button>
      </div>
      <pre>
        <template v-for="message in messages">
          {{ message }}
        </template>
      </pre>
    </div>
  </div>
</template>

<script>
import Peer from 'skyway-js';
const API_KEY = process.env.VUE_APP_SKYWAY_API_KEY || '';

export default {
  name: 'Room',
  components: {},
  data() {
    return {
      mode: 'mesh',
      peer: null,
      videos: [],
      audios: [],
      selectedVideo: null,
      selectedAudio: null,
      stream: null,
      roomName: null,
      room: null,
      remoteStreams: [],
      mute: {
        local: { video: false, audio: false },
        remotes: {},
      },
      message: null,
      messages: [`${new Date()}: Initialized`],
    };
  },
  async created() {
    const devices = await navigator?.mediaDevices?.enumerateDevices() || [];
    this.videos = devices.filter(device => device.kind === 'videoinput');
    this.audios = devices.filter(device => device.kind === 'audioinput');
  },
  mounted() {
    this.initVideo();
    this.initPeer();
  },
  methods: {
    async initVideo() {
      const constraints = {
        video: this.selectedVideo ? { deviceId: { exact: this.selectedVideo } } : false,
        audio: this.selectedAudio ? { deviceId: { exact: this.selectedAudio } } : false,
      };
      try {
        this.stream = await navigator?.mediaDevices?.getUserMedia(constraints);
      } catch (error) {
        console.error('mediaDevice.getUserMedia() error:', error);
        this.stream = null;
        return;
      }

      if (!this.stream) {
        console.error('mediaDevice.getUserMedia() failed:');
        return;
      }
    },
    async resetVideo() {
      if (this.room) {
        await this.initVideo();
        this.replaceStream();
      } else {
        this.close();
        this.initVideo();
      }
    },
    initPeer() {
      this.peer = new Peer({
        key: API_KEY,
        debug: 3,
      });

      // https://webrtc.ecl.ntt.com/api-reference/javascript.html#event-error
      this.peer.on('error', err => {
        if (err.type === 'room-error') {
          this.room = null;
        }
        console.error({ err, msg: 'error' });
        alert(err.message);
      });
    },
    join() {
      if (!this.roomName || !this.peer?.open) {
        return;
      }

      console.log({ msg: '接続' });
      // https://webrtc.ecl.ntt.com/api-reference/javascript.html#joinroom-roomname-roomoptions
      this.room = this.peer.joinRoom(this.roomName, {
        mode: this.mode,
        stream: this.stream,
        videoReceiveEnabled: this.selectedVideo === null,
        audioReceiveEnabled: this.selectedAudio === null,
      });
      this.setEventListeners();
    },
    setEventListeners() {
      if (!this.room) {
        return;
      }

      // Room 接続時
      //   Mesh: https://webrtc.ecl.ntt.com/api-reference/javascript.html#event-open-3
      //   SFU: https://webrtc.ecl.ntt.com/api-reference/javascript.html#event-open-4
      this.room.once('open', this.onRoomOpen);

      // 他ユーザーが接続してきたとき
      //   Mesh: https://webrtc.ecl.ntt.com/api-reference/javascript.html#event-peerjoin
      //   SFU: https://webrtc.ecl.ntt.com/api-reference/javascript.html#event-peerjoin-2
      this.room.on('peerJoin', this.onPeerJoin);

      // 他ユーザーが接続してきたとき(stream data がある場合)
      //   Mesh: https://webrtc.ecl.ntt.com/api-reference/javascript.html#event-stream-2
      //   SFU: https://webrtc.ecl.ntt.com/api-reference/javascript.html#event-stream-3
      this.room.on('stream', this.onStreamRecv);

      // 他ユーザーからのメッセージ受信
      //   Mesh: https://webrtc.ecl.ntt.com/api-reference/javascript.html#event-peerleave
      //   SFU: https://webrtc.ecl.ntt.com/api-reference/javascript.html#event-peerleave-2
      this.room.on('data', this.onDataRecv);

      // 他ユーザーが切断
      //   Mesh: https://webrtc.ecl.ntt.com/api-reference/javascript.html#event-data-2
      //   SFU: https://webrtc.ecl.ntt.com/api-reference/javascript.html#event-data-3
      this.room.on('peerLeave', this.onPeerLeave);

      // 自分が切断
      //   Mesh: https://webrtc.ecl.ntt.com/api-reference/javascript.html#event-close-4
      //   SFU: https://webrtc.ecl.ntt.com/api-reference/javascript.html#event-close-5
      this.room.once('close', this.onClose);
    },
    onRoomOpen() {
      // ログ追加
      this.appendMessage(`You(${this.peer.id}) joined to ${this.roomName}`);
    },
    onPeerJoin(peerId) {
      // ログ追加
      this.appendMessage(`${peerId} joined to ${this.roomName}`);
    },
    async onStreamRecv(stream) {
      this.remoteStreams.push({ peerId: stream.peerId, stream });
      this.mute.remotes[stream.peerId] = { video: false, audio: false };
    },
    onDataRecv({ data, src }) {
      this.appendMessage(`${data} (${src})`);
    },
    onPeerLeave(peerId) {
      // Video を削除
      const remoteVideo = document.querySelector(`video[data-peer-id="${peerId}"]`)
      remoteVideo?.srcObject?.getTracks()?.forEach(track => track.stop());
      this.remoteStreams = this.remoteStreams.filter(stream => stream.peerId !== peerId);
      delete this.mute.remotes[peerId];

      this.appendMessage(`${peerId} left from ${this.roomName}`);
    },
    onClose() {
      this.appendMessage(`You left from ${this.roomName}`);

      // 全ての video(remote) を削除
      document.querySelectorAll('video[data-remote-video]').forEach(remoteVideo => {
        remoteVideo.srcObject.getTracks().forEach(track => track.stop());
      });
      this.remoteStreams = [];
      this.mute.remotes = {};

      // 部屋を削除
      this.room = null;
    },
    onDataSend() {
      if (!this.room || !this.message) {
        return;
      }

      // Mesh: https://webrtc.ecl.ntt.com/api-reference/javascript.html#send-data-2
      // SFU: https://webrtc.ecl.ntt.com/api-reference/javascript.html#send-data-3
      this.room.send(this.message);

      this.appendMessage(`${this.message} (${this.peer.id}: You)`);
      this.message = null;
    },
    close() {
      // Mesh: https://webrtc.ecl.ntt.com/api-reference/javascript.html#close
      // SFU: https://webrtc.ecl.ntt.com/api-reference/javascript.html#close-2
      this.room?.close();
      this.room = null;
    },
    appendMessage(message) {
      this.messages.unshift(`${new Date()}: ${message}`);
      this.messages = this.messages.slice(0, 50);  // 最大50件
    },
    replaceStream() {
      // Mesh: https://webrtc.ecl.ntt.com/api-reference/javascript.html#replacestream-stream-2
      // SFU: https://webrtc.ecl.ntt.com/api-reference/javascript.html#replacestream-stream-3
      this.room?.replaceStream(this.stream);
    },
    // https://webrtc.ecl.ntt.com/api-reference/javascript.html#mediastream%E3%82%92%E3%83%9F%E3%83%A5%E3%83%BC%E3%83%88%E3%81%99%E3%82%8B
    muteMedia() {
      if (this.stream) {
        this.stream?.getVideoTracks()?.forEach(track => track.enabled = !this.mute.local.video);
        this.stream?.getAudioTracks()?.forEach(track => track.enabled = !this.mute.local.audio);
      }
      this.remoteStreams.forEach(stream => {
        stream?.stream?.getVideoTracks()?.forEach(track => track.enabled = !this.mute.remotes[stream.peerId].video);
        stream?.stream?.getAudioTracks()?.forEach(track => track.enabled = !this.mute.remotes[stream.peerId].audio);
      });
    },
  },
}
</script>
