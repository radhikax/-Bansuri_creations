import { useEffect, useRef, useState, type ComponentProps } from 'react';

export function ShimmerImage({ className = '', onLoad, onError, ...props }: ComponentProps<'img'>) {
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLImageElement>(null);

  useEffect(() => {
    setLoaded(ref.current?.complete === true && ref.current.naturalWidth > 0);
  }, [props.src]);

  return (
    <>
      {!loaded && <div className="shimmer absolute inset-0" aria-hidden="true" />}
      <img
        ref={ref}
        {...props}
        onLoad={(e) => {
          setLoaded(true);
          onLoad?.(e);
        }}
        onError={(e) => {
          setLoaded(true);
          onError?.(e);
        }}
        className={`${className} ${loaded ? '' : 'opacity-0'}`}
      />
    </>
  );
}
