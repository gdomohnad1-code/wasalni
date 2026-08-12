import { QueryClient } from "@tanstack/react-query";
import { createRouter, createMemoryHistory } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

// Create a memory history that completely ignores Capacitor's URL paths
// and forces the app to boot directly to the home screen.
const memoryHistory = createMemoryHistory({
  initialEntries: ['/']
});

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    history: memoryHistory, // <--- Inject the memory history here
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
