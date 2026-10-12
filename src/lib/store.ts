import { configureStore } from '@reduxjs/toolkit'
import { setupListeners } from '@reduxjs/toolkit/query'
import { useDispatch, useSelector } from 'react-redux'
import { atlasApi } from '../api/rtk-api'

export function createAppStore() {
  return configureStore({
    reducer: { [atlasApi.reducerPath]: atlasApi.reducer },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(atlasApi.middleware),
  })
}

export const store = createAppStore()
setupListeners(store.dispatch)

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
export const useAppDispatch = useDispatch.withTypes<AppDispatch>()
export const useAppSelector = useSelector.withTypes<RootState>()
