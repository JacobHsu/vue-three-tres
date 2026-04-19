function t(t,a=!0){t.traverse(t=>{t.isSprite&&(t.material.rotation=a?(t.material.rotation||0)+Math.PI:t.material.rotation-Math.PI)})}export{t as fixSpritesForMirror};
