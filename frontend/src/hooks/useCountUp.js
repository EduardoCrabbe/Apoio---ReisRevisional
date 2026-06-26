import { useState, useEffect, useRef } from 'react';
import { useReducedMotion } from 'framer-motion';

/**
 * Anima um número de 0 (ou do valor anterior) até `target` em `duration` ms,
 * com easeOutCubic. Respeita prefers-reduced-motion (vai direto ao valor final).
 * Sem biblioteca externa — só requestAnimationFrame.
 */
export function useCountUp(target = 0, duration = 800) {
  const reduce = useReducedMotion();
  const [value, setValue] = useState(reduce ? target : 0);
  const fromRef = useRef(0);
  const rafRef = useRef(0);

  useEffect(() => {
    if (reduce) {
      setValue(target);
      fromRef.current = target;
      return undefined;
    }
    const inicio = performance.now();
    const de = fromRef.current;
    const passo = (agora) => {
      const t = Math.min(1, (agora - inicio) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setValue(de + (target - de) * eased);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(passo);
      } else {
        fromRef.current = target;
      }
    };
    rafRef.current = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration, reduce]);

  return value;
}
