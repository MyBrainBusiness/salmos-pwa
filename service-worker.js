const CACHE_NAME = 'salmos-pwa-v1.0.0';
const urlsToCache = [
  '/salmos-pwa/',
  '/salmos-pwa/index.html',
  '/salmos-pwa/manifest.json',
  '/salmos-pwa/icon-192.png',
  '/salmos-pwa/icon-512.png'
];

// URLs que sempre devem buscar da rede (APIs)
const networkOnlyUrls = [
  'https://n8neditor.mybrain.business',
  'https://api.biblesupersearch.com',
  'https://bible-api.com'
];

// Instalar Service Worker
self.addEventListener('install', function(event) {
  console.log('[SALMOS SW] Instalando Service Worker...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('[SALMOS SW] Cache criado com sucesso');
        return cache.addAll(urlsToCache);
      })
      .then(function() {
        console.log('[SALMOS SW] Arquivos em cache');
        return self.skipWaiting(); // Ativa imediatamente
      })
  );
});

// Ativar Service Worker
self.addEventListener('activate', function(event) {
  console.log('[SALMOS SW] Ativando Service Worker...');
  
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          // Remove caches antigos
          if (cacheName !== CACHE_NAME) {
            console.log('[SALMOS SW] Removendo cache antigo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(function() {
      console.log('[SALMOS SW] Service Worker ativado');
      return self.clients.claim(); // Controla todas as abas
    })
  );
});

// Interceptar requisições
self.addEventListener('fetch', function(event) {
  const requestUrl = new URL(event.request.url);
  
  // APIs sempre da rede
  if (networkOnlyUrls.some(url => event.request.url.includes(url))) {
    event.respondWith(
      fetch(event.request)
        .catch(function() {
          // Se API falhar, retorna resposta offline
          return new Response(
            JSON.stringify({
              error: 'Sem conexão',
              message: 'Verifique sua conexão com a internet'
            }),
            {
              headers: { 'Content-Type': 'application/json' },
              status: 503
            }
          );
        })
    );
    return;
  }

  // Estratégia: Cache First para recursos estáticos
  event.respondWith(
    caches.match(event.request)
      .then(function(response) {
        // Se está em cache, retorna do cache
        if (response) {
          console.log('[SALMOS SW] Servindo do cache:', event.request.url);
          return response;
        }

        // Se não está em cache, busca da rede
        console.log('[SALMOS SW] Buscando da rede:', event.request.url);
        return fetch(event.request).then(function(response) {
          // Verifica se é uma resposta válida
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // Clona a resposta
          const responseToCache = response.clone();

          // Adiciona ao cache para próximas requisições
          caches.open(CACHE_NAME)
            .then(function(cache) {
              cache.put(event.request, responseToCache);
            });

          return response;
        });
      })
      .catch(function() {
        // Se falhou, retorna página offline para navegação
        if (event.request.destination === 'document') {
          return caches.match('/salmos-pwa/index.html');
        }
        
        // Para outros recursos, retorna erro
        return new Response('Recurso não disponível offline', {
          status: 503,
          statusText: 'Service Unavailable'
        });
      })
  );
});

// Sincronização em background
self.addEventListener('sync', function(event) {
  console.log('[SALMOS SW] Sincronização em background:', event.tag);
  
  if (event.tag === 'sync-sermon-data') {
    event.waitUntil(syncSermonData());
  }
});

// Notificações Push
self.addEventListener('push', function(event) {
  console.log('[SALMOS SW] Push recebido:', event);
  
  const options = {
    body: event.data ? event.data.text() : 'Nova pregação disponível!',
    icon: '/salmos-pwa/icon-192.png',
    badge: '/salmos-pwa/icon-72.png',
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'open',
        title: 'Abrir SALMOS',
        icon: '/salmos-pwa/icon-192.png'
      },
      {
        action: 'close',
        title: 'Fechar'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('📖 SALMOS', options)
  );
});

// Clique em notificação
self.addEventListener('notificationclick', function(event) {
  console.log('[SALMOS SW] Notificação clicada:', event);
  
  event.notification.close();

  if (event.action === 'open') {
    event.waitUntil(
      clients.openWindow('/salmos-pwa/')
    );
  }
});

// Função para sincronizar dados de pregação
async function syncSermonData() {
  try {
    console.log('[SALMOS SW] Sincronizando dados de pregação...');
    
    // Buscar dados pendentes do IndexedDB
    const pendingData = await getPendingSermonData();
    
    if (pendingData.length > 0) {
      // Enviar dados para servidor
      for (const data of pendingData) {
        await fetch('/api/sync-sermon', {
          method: 'POST',
          body: JSON.stringify(data),
          headers: {
            'Content-Type': 'application/json'
          }
        });
      }
      
      // Limpar dados pendentes
      await clearPendingSermonData();
      console.log('[SALMOS SW] Sincronização concluída');
    }
  } catch (error) {
    console.error('[SALMOS SW] Erro na sincronização:', error);
  }
}

// Funções auxiliares para IndexedDB (implementar se necessário)
async function getPendingSermonData() {
  // Implementar busca no IndexedDB
  return [];
}

async function clearPendingSermonData() {
  // Implementar limpeza no IndexedDB
  return true;
}

// Logs de debug
self.addEventListener('message', function(event) {
  console.log('[SALMOS SW] Mensagem recebida:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
