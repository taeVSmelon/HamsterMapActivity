<script setup>
import UnityWebgl from 'unity-webgl';
import VueUnity from 'unity-webgl/vue';
import { onMounted, ref } from 'vue';

const unityContext = new UnityWebgl({
  loaderUrl: '/.proxy/Build/HamsterMap.loader.js',
  dataUrl: '/.proxy/Build/HamsterMap.data.unityweb',
  frameworkUrl: '/.proxy/Build/HamsterMap.framework.js.unityweb',
  codeUrl: '/.proxy/Build/HamsterMap.wasm.unityweb'
});

const unityRef = ref(null);

onMounted(() => {
  // ปรับ style ของ body และ html ตอนโหลด
  document.body.style.margin = '0';
  document.body.style.padding = '0';
  document.body.style.overflow = 'hidden';
  document.documentElement.style.margin = '0';
  document.documentElement.style.padding = '0';
  document.documentElement.style.overflow = 'hidden';

  // รอ Unity โหลดเสร็จ แล้วค่อยสั่ง fullscreen
  unityContext.on('loaded', () => {
    unityContext.setFullscreen(true);
  });
});
</script>

<template>
  <div style="width: 100vw; height: 100vh;">
    <VueUnity ref="unityRef" :unity="unityContext" style="width: 100%; height: 100%;" />
  </div>
</template>
