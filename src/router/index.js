import Vue from 'vue'
import VueRouter from 'vue-router'
import P2P from '../views/P2P.vue'

Vue.use(VueRouter)

const routes = [
  {
    path: '/',
    name: 'P2P',
    component: P2P
  },
  {
    path: '/room',
    name: 'Room',
    component: () => import(/* webpackChunkName: "room" */ '../views/Room.vue')
  }
]

const router = new VueRouter({
  mode: 'history',
  base: process.env.BASE_URL,
  routes
})

export default router
