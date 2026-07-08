import { createContext, useContext } from "react";

/** App-wide count of unread chat messages, so the bottom-nav / sidebar can
    show a badge on the Messages tab from any screen. Provided by App. */
export const UnreadContext = createContext<number>(0);

export const useUnread = () => useContext(UnreadContext);
