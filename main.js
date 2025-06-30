// TODO: Thay đổi URL bên dưới thành URL Render backend của bạn khi deploy
const SIGNALING_SERVER_URL = 'http://localhost:3000'; // ví dụ: 'https://xemchung-backend.onrender.com'
const socket = io(SIGNALING_SERVER_URL);
let pc = new RTCPeerConnection();
let localStream;
let isSharing = false;
let isConnected = false;
const statusEl = document.getElementById('status');
const localVideo = document.getElementById('localVideo');
const shareBtn = document.getElementById('share');
const stopShareBtn = document.getElementById('stopShare');
const toastEl = document.getElementById('toast');
const viewerNumEl = document.getElementById('viewerNum');
const localVideoControls = document.getElementById('localVideoControls');
const localFullscreenBtn = document.getElementById('localFullscreen');
const localExpandBtn = document.getElementById('localExpand');
const qualitySelect = document.getElementById('quality');

const QUALITY_PRESETS = {
  ultra: { width: 3840, height: 2160, frameRate: 60, bitrate: 12000_000 }, // 4K
  high:  { width: 1920, height: 1080, frameRate: 60, bitrate: 6000_000 },  // 1080p
  medium:{ width: 1280, height: 720,  frameRate: 30, bitrate: 2500_000 },  // 720p
  low:   { width: 854,  height: 480,  frameRate: 24, bitrate: 1000_000 }   // 480p
};

function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  setTimeout(() => toastEl.classList.remove('show'), 2500);
}

function setStatus(text, color = '#a0e7ff') {
  statusEl.textContent = text;
  statusEl.style.color = color;
}

shareBtn.onclick = async () => {
  try {
    const preset = QUALITY_PRESETS[qualitySelect.value] || QUALITY_PRESETS.high;
    localStream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        frameRate: preset.frameRate,
        width: { ideal: preset.width },
        height: { ideal: preset.height }
      }
    });
    localVideo.srcObject = localStream;
    localVideo.hidden = false;
    localVideoControls.hidden = false;
    isSharing = true;
    setStatus('Đang chia sẻ màn hình', '#4f8cff');
    showToast('Bạn đang chia sẻ màn hình!');
    localStream.getTracks().forEach(track => {
      const sender = pc.addTrack(track, localStream);
      // Tăng bitrate cho video
      if (track.kind === 'video') {
        setTimeout(() => {
          if (sender && sender.setParameters) {
            const params = sender.getParameters();
            if (!params.encodings) params.encodings = [{}];
            params.encodings[0].maxBitrate = preset.bitrate;
            sender.setParameters(params);
          }
        }, 500);
      }
    });
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit('signal', { desc: pc.localDescription });
    shareBtn.disabled = true;
    shareBtn.textContent = 'Đang chia sẻ...';
    stopShareBtn.style.display = '';
    localStream.getVideoTracks()[0].onended = () => {
      stopSharing();
      showToast('Đã dừng chia sẻ màn hình');
    };
  } catch (e) {
    showToast('Bạn đã huỷ hoặc không cấp quyền chia sẻ.');
  }
};

stopShareBtn.onclick = () => {
  stopSharing();
  showToast('Đã dừng chia sẻ màn hình');
};

function stopSharing() {
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }
  localVideo.srcObject = null;
  localVideo.hidden = true;
  localVideoControls.hidden = true;
  isSharing = false;
  setStatus('Đã dừng chia sẻ', '#ffb347');
  shareBtn.disabled = false;
  shareBtn.textContent = 'Chia sẻ màn hình';
  stopShareBtn.style.display = 'none';
}

// Viewer count logic
socket.on('viewer-count', n => {
  viewerNumEl.textContent = n;
});
// Gửi yêu cầu cập nhật số người xem khi kết nối
socket.emit('get-viewer-count');

// Fullscreen & Expanded view logic
function toggleFullscreen(video) {
  if (video.requestFullscreen) video.requestFullscreen();
  else if (video.webkitRequestFullscreen) video.webkitRequestFullscreen();
  else if (video.msRequestFullscreen) video.msRequestFullscreen();
}
function toggleExpand(video) {
  video.classList.toggle('expanded');
}
localFullscreenBtn.onclick = () => toggleFullscreen(localVideo);
localExpandBtn.onclick = () => toggleExpand(localVideo);

// Khi reload lại, reset trạng thái
window.addEventListener('load', () => {
  setStatus('Chưa kết nối', '#a0e7ff');
  localVideo.hidden = true;
  localVideoControls.hidden = true;
  stopShareBtn.style.display = 'none';
}); 