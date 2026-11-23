import { describe, it, expect } from 'vitest'
import { niceMax, linePath, areaPath, buildChart, CHART } from '../src/lib/chartGeometry.js'

describe('chartGeometry', () => {
  it('rounds axis maxima up to readable numbers', () => {
    expect(niceMax(0)).toBe(10)
    expect(niceMax(119.7)).toBe(200)
    expect(niceMax(299)).toBe(500)
    expect(niceMax(15)).toBe(20)
    expect(niceMax(100)).toBe(100)
    expect(niceMax(240)).toBe(250)
  })

  it('breaks lines and areas at missing values', () => {
    const x = (i) => i * 10
    const y = (v) => 100 - v
    expect(linePath([1, 2, null, 4], x, y)).toBe('M0.0,99.0L10.0,98.0M30.0,96.0')
    expect(areaPath([1, null, 4, 5], x, y, 100)).toBe('M0.0,99.0L0.0,100L0.0,100ZM20.0,96.0L30.0,95.0L30.0,100L20.0,100Z')
    expect(linePath([null, null], x, y)).toBe('')
  })

  it('maps points to the plot box and finds the nearest index', () => {
    const g = buildChart([{ time: 'a', pm25: 0, aqi: 0 }, { time: 'b', pm25: 100, aqi: 200 }, { time: 'c', pm25: null, aqi: null }])
    expect(g.x(0)).toBe(CHART.left)
    expect(g.x(2)).toBe(CHART.width - CHART.right)
    expect(g.yPm(0)).toBe(g.base)
    expect(g.yPm(100)).toBe(CHART.top)
    expect(g.yAqi(200)).toBe(CHART.top)
    expect(g.indexAt(-50)).toBe(0)
    expect(g.indexAt(9999)).toBe(2)
    expect(g.pmTicks).toHaveLength(5)
    expect(g.whoY).toBeLessThan(g.base)
  })

  it('handles a single point', () => {
    const g = buildChart([{ time: 'a', pm25: 20, aqi: 40 }])
    expect(g.pmLine.startsWith('M')).toBe(true)
    expect(g.indexAt(400)).toBe(0)
  })
})
