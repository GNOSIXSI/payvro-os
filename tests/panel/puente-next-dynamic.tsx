import { useEffect, useState, type ComponentType } from "react";

type Modulo<P> = ComponentType<P> | { default: ComponentType<P> };

export default function dynamic<P extends object>(cargador: () => Promise<Modulo<P>>) {
  return function Dinamico(props: P) {
    const [Componente, setComponente] = useState<ComponentType<P> | null>(null);

    useEffect(() => {
      let vivo = true;
      void cargador().then((modulo) => {
        if (!vivo) {
          return;
        }
        const siguiente = typeof modulo === "function" ? modulo : modulo.default;
        setComponente(() => siguiente);
      });
      return () => {
        vivo = false;
      };
    }, []);

    if (!Componente) {
      return null;
    }
    return <Componente {...props} />;
  };
}
