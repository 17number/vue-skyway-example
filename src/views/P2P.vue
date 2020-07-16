<!-- reference: https://github.com/skyway/skyway-js-sdk/tree/master/examples/p2p-media  -->
<template>
  <div class="p2p">
    <h2>P2P (example)</h2>
    <div id="me">
      <h3>Source (You)</h3>
      <video id="my-video" width="400px" autoplay muted playsinline></video>
      <p>My Peer ID: {{ srcId }}</p>
    </div>
    <div id="dest">
      <div>
        <label for="dest-id">Destination Peer ID</label>
        <input type="text" id="dest-id" v-model="destId">
        <button id="make-call" @click="call" v-if="!mediaConnection">発信</button>
        <button id="close" @click="close" v-if="mediaConnection">切断</button>
      </div>
      <h3>Destination</h3>
      <video id="dest-video" width="400px" autoplay playsinline></video>
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
      stream: null,
      srcId: null,
      destId: null,
      mediaConnection: null,
    };
  },
  mounted() {
    this.initVideo();
    this.initPeer();
  },
  methods: {
    async initVideo() {
      try {
        this.stream = await navigator?.mediaDevices?.getUserMedia({video: true, audio: true})
      } catch (error) {
        console.error('mediaDevice.getUserMedia() error:', error);
        alert('ビデオの初期化に失敗しました。');
        return;
      }

      if (!this.stream) {
        console.error('mediaDevice.getUserMedia() failed:');
        alert('ビデオの初期化に失敗しました。');
        return;
      }

      const videoElm = document.getElementById('my-video')
      videoElm.srcObject = this.stream;
      videoElm.play();
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
        videoElm.srcObject = stream;
        videoElm.play();
      });

      // https://webrtc.ecl.ntt.com/api-reference/javascript.html#event-close-2
      this.mediaConnection.once('close', () => {
        videoElm.srcObject.getTracks().forEach(track => track.stop());
        videoElm.srcObject = null;
        this.mediaConnection = null;
      });
    },
    close() {
      // https://webrtc.ecl.ntt.com/api-reference/javascript.html#close-forceclose
      this.mediaConnection?.close(true);
      this.mediaConnection = null;
    },
  },
}
</script>
