import { combineReducers, configureStore } from "@reduxjs/toolkit";
import socketReducer from "./socket/socketSlice";
import playerReducer from "./admin/playersSlice";
import timerReducer from "./timer/timerSlice";
import screenReducer from "./player/screenSlice";
import adminScreenReducer from "./admin/screenSlice";
import playerResultReducer from "./player/resultSlice";
import pageThemeReducer from "./pageThemeSlice";
import hideQuestionsReducer from "./hideQuestionsSlice";
import navToggleReducer from "./admin/navtoggleSlice";
import gridListToggleReducer from "./admin/gridListSlice";

import {
  FLUSH,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
  REHYDRATE,
  persistReducer,
} from "redux-persist";
import storage from "redux-persist/lib/storage";
import persistStore from "redux-persist/es/persistStore";
import type { PersistConfig, PersistedState } from "redux-persist";

import { createConnection } from "./socket/socketSlice";

const rootReducer = combineReducers({
  socket: socketReducer,
  player: playerReducer,
  timer: timerReducer,
  screen: screenReducer,
  pageTheme: pageThemeReducer,
  hideQuestions: hideQuestionsReducer,
  navToggle: navToggleReducer,
  adminScreen: adminScreenReducer,
  playerResult: playerResultReducer,
  gridListToggle: gridListToggleReducer,
});

const persistConfig: PersistConfig<ReturnType<typeof rootReducer>> = {
  key: "root",
  storage,
  version: 1,
  migrate: async (state): Promise<PersistedState> => {
    if (!state) return state;
    const legacy = state as PersistedState & Record<string, unknown>;
    if ("adminscreen" in legacy && !("adminScreen" in legacy)) {
      return {
        ...legacy,
        adminScreen: legacy.adminscreen,
      } as PersistedState;
    }
    return legacy;
  },
  /** Live Socket.IO clients must not be persisted to storage. */
  blacklist: ["socket"],
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [
          FLUSH,
          REHYDRATE,
          PAUSE,
          PERSIST,
          PURGE,
          REGISTER,
          createConnection.type,
        ],
        ignoredPaths: ["socket.socket", "_persist"],
      },
    }),
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
