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

import { persistReducer } from "redux-persist";
import storage from "redux-persist/lib/storage";
import persistStore from "redux-persist/es/persistStore";

const rootReducer = combineReducers({
  socket: socketReducer,
  player: playerReducer,
  timer: timerReducer,
  screen: screenReducer,
  pageTheme: pageThemeReducer,
  hideQuestions: hideQuestionsReducer,
  navToggle: navToggleReducer,
  adminscreen: adminScreenReducer,
  playerResult: playerResultReducer,
  gridListToggle: gridListToggleReducer,
});

const persistConfig = {
  key: "root",
  storage,
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
