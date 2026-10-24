import { combineReducers, configureStore } from "@reduxjs/toolkit";
import playerReducer from "./admin/playersSlice";
import gameReducer from "./game/gameSlice";
import pageThemeReducer, { PageTheme } from "./pageThemeSlice";
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

const rootReducer = combineReducers({
  player: playerReducer,
  game: gameReducer,
  pageTheme: pageThemeReducer,
  hideQuestions: hideQuestionsReducer,
  navToggle: navToggleReducer,
  gridListToggle: gridListToggleReducer,
});

const persistConfig: PersistConfig<ReturnType<typeof rootReducer>> = {
  key: "root",
  storage,
  version: 3,
  migrate: async (state): Promise<PersistedState> => {
    if (!state) return state;
    let legacy = state as PersistedState & Record<string, unknown>;
    if ("adminscreen" in legacy && !("adminScreen" in legacy)) {
      legacy = { ...legacy, adminScreen: legacy.adminscreen };
    }
    // Before v3 the theme defaulted to light, so a stored "light" was not
    // necessarily chosen: follow the device instead. Dark was a choice.
    const theme = legacy.pageTheme as { theme?: PageTheme } | undefined;
    if (
      (legacy._persist?.version ?? -1) < 3 &&
      theme?.theme === PageTheme.light
    ) {
      legacy = { ...legacy, pageTheme: { ...theme, theme: PageTheme.system } };
    }
    return legacy;
  },
  /** Live game state is server-owned and resynced on connect; never persist it. */
  blacklist: ["game"],
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
        ignoredPaths: ["_persist"],
      },
    }),
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
