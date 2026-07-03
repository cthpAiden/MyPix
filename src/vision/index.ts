/** Vision layer barrel (contracts/vision.md). */
export * from './types';
export { FACE_REGIONS, warpVertexIndices } from './regions';
export { facePolygons, type FacePolygons } from './facePolygons';
export { getFaceProvider, disposeFaceProvider } from './faceLandmarker';
export { getPoseProvider, disposePoseProvider } from './poseLandmarker';
export { getSegmentationProvider, disposeSegmentationProvider } from './segmenter';
export { LandmarkCache } from './cache';
export { MODEL_URLS } from './modelLoader';
