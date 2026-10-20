import * as THREE from "three";

// Paleta do holograma: fundo azul-marinho quase preto, malha branca, bordas ciano,
// alerta magenta/vermelho pra tudo que é negativo (preço subindo, imposto, carrinho caro).
export const WIRE = {
  bg0: "#02060D",
  bg1: "#061A2E",
  white: "#E8F4FF",
  cyan: "#2EE6F0",
  cyanDim: "#0E5A66",
  alert: "#FF2E63",
};

// Cor "acima de 1" pro bloom pegar (os materiais usam toneMapped={false}).
export const glow = (hex: string, k = 1) => new THREE.Color(hex).multiplyScalar(k);

export const WIDTH = 1080;
export const HEIGHT = 1920;
