"use client";
import { useEffect, useRef } from "react";
import "swagger-ui-dist/swagger-ui.css";

export function Swagger() {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let disposed = false;
    import("swagger-ui-dist/swagger-ui-bundle").then(({ default: SwaggerUI }) => {
      if (!disposed && container.current) SwaggerUI({ url: "/api/openapi", domNode: container.current, withCredentials: true, persistAuthorization: false });
    });
    return () => { disposed = true; };
  }, []);
  return <div ref={container} />;
}
