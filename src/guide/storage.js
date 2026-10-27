// 체크 상태 저장소 (localStorage)
//
// 사생활 보호 모드나 저장 공간이 꽉 찬 경우 localStorage 읽기·쓰기가 오류를 낸다.
// 그래도 페이지는 정상 동작해야 하므로 모든 접근을 try/catch 로 감싸고,
// 저장이 안 되면 메모리에만 들고 있다가 화면에 "저장되지 않아요" 안내만 띄운다.
const KEY = 'mycarland.guide.v1';

function read() {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function write(state) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

// 실제로 써 보고 지워 봐야 저장 가능 여부를 알 수 있다
function probe() {
  try {
    const k = `${KEY}.probe`;
    window.localStorage.setItem(k, '1');
    window.localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

export function createStore() {
  const saved = read();
  const state = {
    done: new Set(Array.isArray(saved?.done) ? saved.done : []), // 찍은 컷 번호
    checklist: { ...(saved?.checklist ?? {}) }, // 보내기 전 체크 (landscape, sharp, original)
  };
  const listeners = new Set();
  const available = probe();

  function save() {
    write({ done: [...state.done], checklist: state.checklist });
    listeners.forEach((fn) => fn(state));
  }

  return {
    available,
    state,
    isDone: (id) => state.done.has(id),
    setDone(id, value) {
      if (value) state.done.add(id);
      else state.done.delete(id);
      save();
    },
    setChecklist(key, value) {
      state.checklist[key] = value;
      save();
    },
    reset() {
      state.done.clear();
      state.checklist = {};
      save();
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
