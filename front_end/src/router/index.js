import { createRouter, createWebHistory } from 'vue-router';
import Dashboard from '@/views/DashboardPage.vue';
import Supply from '@/views/SupplyPage.vue';
import Borrow from '@/views/BorrowPage.vue';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'Dashboard',
      component: Dashboard
    },
    {
      path: '/supply',
      name: 'Supply',
      component: Supply
    },
    {
      path: '/borrow',
      name: 'Borrow',
      component: Borrow
    },
    // 404重定向
    {
      path: '/:pathMatch(.*)*',
      redirect: '/'
    }
  ]
});

export default router;