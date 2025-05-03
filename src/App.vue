<template>
  <div
    ref="container"
    style="width: 100%; height: 100vh; display: flex; justify-content: center; align-items: center; background: black;">
    <VueUnity
      ref="unityRef"
      :unity="unityContext"
      :style="{
        width: resolution.width + 'px',
        height: resolution.height + 'px',
        maxWidth: '100%',
        maxHeight: '100%',
        background: 'black',
      }"
    />
  </div>
</template>

<script setup>
import UnityWebgl from 'unity-webgl';
import VueUnity from 'unity-webgl/vue';
import { onMounted, ref, reactive } from 'vue';

const unityContext = new UnityWebgl({
  loaderUrl: '/.proxy/api/build/HamsterMap.loader.js',
  dataUrl: '/.proxy/api/build/HamsterMap.data.br',
  frameworkUrl: '/.proxy/api/build/HamsterMap.framework.js.br',
  codeUrl: '/.proxy/api/build/HamsterMap.wasm.br',
  streamingAssetsUrl: 'StreamingAssets',
  companyName: 'HamsterHub',
  productName: 'HamsterMap',
  productVersion: '1.0',
  crossOrigin: 'anonymous'
});

const unityRef = ref(null);

// กำหนด resolution สำหรับ Discord Activity
const resolution = reactive({ width: window.innerWidth, height: window.innerHeight });

onMounted(() => {
  document.body.style.margin = '0';
  document.body.style.padding = '0';
  document.body.style.overflow = 'hidden';
  document.documentElement.style.margin = '0';
  document.documentElement.style.padding = '0';
  document.documentElement.style.overflow = 'hidden';

  unityContext.on('loaded', () => {
    // หากต้องการ fullscreen จริง (เช่น F11 หรือปุ่ม fullscreen) ใช้ setFullscreen
    unityContext.setFullscreen(false); // หรือ true ถ้าอยากให้เต็มจอจริง
  });
});
</script>
