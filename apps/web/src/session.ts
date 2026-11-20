import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Account, ApiError, request, write } from './api';

export function useSession() {
  const client = useQueryClient();
  useEffect(() => {
    const clear = () => {
      client.setQueryData(['session'], null);
      client.removeQueries({ predicate: (q) => q.queryKey[0] !== 'session' });
    };
    window.addEventListener('utae:unauthenticated', clear);
    return () => window.removeEventListener('utae:unauthenticated', clear);
  }, [client]);
  const query = useQuery({
    queryKey: ['session'],
    retry: false,
    staleTime: 0,
    queryFn: async () => {
      try {
        return await request<Account>('/me');
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    },
  });
  const change = async (action: () => Promise<Account | null>) => {
    await client.cancelQueries();
    client.clear();
    try {
      const account = await action();
      client.setQueryData(['session'], account);
    } finally {
      await client.invalidateQueries();
    }
  };
  return {
    ...query,
    login: (username: string, password: string) =>
      change(() => write<Account>('/auth/login', { username, password })),
    logout: () =>
      change(async () => {
        await write('/auth/logout');
        return null;
      }),
  };
}
