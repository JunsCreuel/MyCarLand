// 기기 조건 확인 모음
import site from '../config/site.json';

const MOBILE_MAX = site.frames?.mobileMaxWidth ?? 768;

// 화면 폭이 기준(768px) 미만이면 모바일 프레임 세트를 쓴다
export const mobileQuery = window.matchMedia(`(max-width: ${MOBILE_MAX - 0.02}px)`);
export const frameSet = () => (mobileQuery.matches ? 'mobile' : 'desktop');

// 운영체제의 "동작 줄이기" 설정
export const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
