<!-- reference: https://github.com/skyway/skyway-js-sdk/tree/master/examples/p2p-media  -->
<template>
  <div class="p2p">
    <h2>P2P (example)</h2>
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
      <p>My Peer ID: {{ srcId }}</p>
    </div>
    <div id="dest">
      <!-- 接続先 -->
      <div>
        <label for="dest-id">Destination Peer ID</label>
        <input type="text" id="dest-id" v-model="destId">
      </div>
      <div>
        <button id="make-call" @click="call" v-if="!mediaConnection">発信</button>
        <button id="close" @click="close" v-if="mediaConnection">切断</button>
      </div>
      <h3>Destination</h3>
      <video
        id="dest-video"
        width="400px"
        autoplay
        playsinline
        :srcObject.prop="remoteStream"
        v-if="remoteStream"
      />
    </div>
  </div>
</template>

<script>
import Peer from 'skyway-js';
const API_KEY = process.env.VUE_APP_SKYWAY_API_KEY || '';

export default {
  name: 'P2P',
  components: {},
  data() {
    return {
      peer: null,
      videos: [],
      audios: [],
      selectedVideo: null,
      selectedAudio: null,
      stream: null,
      remoteStream: null,
      srcId: null,
      destId: null,
      mediaConnection: null,
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
        return;
      }

      if (!this.stream) {
        console.error('mediaDevice.getUserMedia() failed:');
        return;
      }
    },
    closeVideo() {
      if (!this.stream) {
        console.log('no opening stream');
        return;
      }

      const videoElm = document.getElementById('my-video');
      if (videoElm?.srcObject) {
        videoElm.srcObject.getTracks()?.forEach(track => track.stop());
        videoElm.srcObject = null;
        console.log('video stopped');
      }
      this.stream = null;
    },
    resetVideo() {
      this.closeVideo();
      this.initVideo();
    },
    initPeer() {
      this.peer = new Peer({
        key: API_KEY,
        debug: 3,
      });

      // https://webrtc.ecl.ntt.com/api-reference/javascript.html#event-open
      this.peer.on('open', () => {
        this.srcId = this.peer.id;
      });

      // https://webrtc.ecl.ntt.com/api-reference/javascript.html#event-call
      this.peer.on('call', mediaConnection => {
        console.log({ msg: '着信' });
        // https://webrtc.ecl.ntt.com/api-reference/javascript.html#answer-stream-options
        this.mediaConnection = mediaConnection;
        this.mediaConnection.answer(this.stream);
        this.setEventListener(this.mediaConnection);
      });

      // https://webrtc.ecl.ntt.com/api-reference/javascript.html#event-error
      this.peer.on('error', err => {
        console.error({ err, msg: 'error' });
        alert(err.message);
      });

      // https://webrtc.ecl.ntt.com/api-reference/javascript.html#event-close
      this.peer.on('close', () => {
        this.mediaConnection = null;
        console.log({ msg: '通信が切断しました。' });
        alert('通信が切断しました。');
      });
    },
    call() {
      if (!this.destId || !this.peer?.open) {
        return;
      }

      console.log({ msg: '発信' });
      // https://webrtc.ecl.ntt.com/api-reference/javascript.html#call-peerid-stream-options
      this.mediaConnection = this.peer.call(this.destId, this.stream);
      this.setEventListener(this.mediaConnection);
    },
    setEventListener() {
      const videoElm = document.getElementById('dest-video')
      // https://webrtc.ecl.ntt.com/api-reference/javascript.html#event-stream
      this.mediaConnection.on('stream', stream => {
        // video要素にカメラ映像をセットして再生
        console.log({ on: 'rcv stream', stream });
        this.remoteStream = stream;
      });

      // https://webrtc.ecl.ntt.com/api-reference/javascript.html#event-close-2
      this.mediaConnection.once('close', () => {
        if (videoElm?.srcObject) {
          videoElm.srcObject?.getTracks()?.forEach(track => track.stop());
          videoElm.srcObject = null;
        }
        this.mediaConnection = null;
        this.remoteStream = null;
      });
    },
    close() {
      // https://webrtc.ecl.ntt.com/api-reference/javascript.html#close-forceclose
      this.mediaConnection?.close(true);
      this.mediaConnection = null;
      this.remoteStream = null;
    },
  },
}
</script>
