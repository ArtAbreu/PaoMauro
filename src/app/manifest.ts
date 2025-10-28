import { MetadataRoute } from "next";
import manifest from "../manifest.webmanifest" assert { type: "json" };

export default function manifestRoute(): MetadataRoute.Manifest {
  return manifest as MetadataRoute.Manifest;
}
