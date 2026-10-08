import { defineConfig } from '@playwright/test'
export default defineConfig({testDir:'./e2e',timeout:90000,expect:{timeout:15000},workers:1,fullyParallel:false,retries:0,forbidOnly:!!process.env.CI,reporter:[['list'],['html',{open:'never'}],['junit',{outputFile:'test-results/results.xml'}]],outputDir:'test-results'})
