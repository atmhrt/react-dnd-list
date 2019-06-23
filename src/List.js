import React, { Fragment } from 'react'
import { createControlledItem } from './Item'
import { inRange, arrayShift, clamp } from './util'

import './styles.css'

const CLASSES = {
  DRAGGABLE: 'dnd-list__draggable',
  IN_DRAG: 'dnd-list__in-drag',
  TRANSITION: 'dnd-list__transition'
}

const initState = {
  // List controll
  drag: false,
  drop: false,
  step: 0,
  nearbyItems: {},

  // Dragged element controll
  index: null,
  origin: 0,
  offset: 0,
  newOriginOffset: 0,
  offsetLimits: {},

  dragInput: null, //'MOUSE' or 'TOUCH'
}

class List extends React.Component {
  constructor(props) {
    super(props)
    this.state = initState

    this.itemComponent = createControlledItem(this.props.itemComponent)
    this.keywords = this.props.horizontal
      ? { start: 'left', end: 'right', size: 'width', inputPos: 'clientX' }
      : { start: 'top', end: 'bottom', size: 'height', inputPos: 'clientY' }
    this.transitionStyles = this.props.transitionStyles
      ? this.props.transitionStyles
      : {}

    this.itemRefs = []
    this.itemDims = []
    this.itemPos = this.props.items.map((item, index) => index)
  }

  componentDidMount() {
    this.getItemDims()
  }

  componentDidUpdate(prevProps, prevState) {
    if (prevState.drag && !this.state.drag) { // after handleDropEnd
      this.getItemDims()
      this.setState(initState)
    }
  }

  // Drag and drop functionality -----------------------------------------------

  handleDragStart = (index, event, dragInput) => {
    if (this.state.drag) { return }
    this.setDnDEventListeners(window.addEventListener)

    const origin = dragInput === 'MOUSE'
      ? event[this.keywords.inputPos]
      : event.touches[0][this.keywords.inputPos]

    this.setState({
      index, origin, dragInput, drag: true,
      nearbyItems: { prev: index - 1, next: index + 1 },
      offsetLimits: this.getOffsetLimits(index)
    })
  }

  handleDrag = (event) => {
    const offset = this.getOffset(event)

    const prev = this.itemDims[this.state.nearbyItems.prev]
    const next = this.itemDims[this.state.nearbyItems.next]

    if (
      this.state.nearbyItems.next < this.props.items.length &&
      offset - this.state.newOriginOffset >= next.threshold
    ) {
      this.swap(this.state.step + 1)
    }

    else if (
      this.state.nearbyItems.prev > -1 &&
      offset - this.state.newOriginOffset <= -prev.threshold
    ) {
      this.swap(this.state.step - 1)
    }

    if (offset !== this.state.offset) {
      this.setState({ offset })
    }
  }

  swap = (newStep) => {
    const { prev, next } = this.state.nearbyItems
    const { size } = this.keywords
    let swapped = {}

    if (newStep > this.state.step) {
      this.state.nearbyItems = { prev: next, next: next + 1 }
      swapped = { index: next, [size]: this.itemDims[next][size] }
    } else {
      this.state.nearbyItems = { prev: prev - 1, next: prev }
      swapped = { index: prev, [size]: -this.itemDims[prev][size] } // Negative size
    }

    if (newStep === 0) {
      this.state.nearbyItems = { prev: this.state.index - 1, next: this.state.index + 1 }
    }

    this.setState({
      step: newStep,
      newOriginOffset: this.state.newOriginOffset + swapped[size]
    })
  }

  handleDrop = () => {
    this.setDnDEventListeners(window.removeEventListener)

    if (
      !this.props.disableTransitions &&
      Math.abs(this.state.offset - this.state.newOriginOffset) > 1
    ) {
      this.itemRefs[this.itemPos[this.state.index]].addEventListener('transitionend', this.handleDropTransition)
      this.setState({ drop: true, offset: this.state.newOriginOffset })
    } else {
      this.handleDropEnd()
    }
  }

  handleDropTransition = (element) => {
    if (
      element.propertyName === this.keywords.start &&
      element.target.className.includes(CLASSES.DRAGGABLE)
    ) {
      this.handleDropEnd()
    }
  }

  handleDropEnd = () => {
    this.itemRefs[this.itemPos[this.state.index]].removeEventListener('transitionend', this.handleDropEnd)
    this.itemRefs[this.itemPos[this.state.index]].removeEventListener('transitionend', this.handleDropTransition)

    const { index, step } = this.state

    this.itemPos = arrayShift(this.itemPos, index, step)
    this.props.setList(arrayShift(this.props.items, index, step))

    this.setState({ ...initState, index: index + step })
    // Final stage of drop happens in componentDidUpdate
  }

  // Render --------------------------------------------------------------------

  render() {
    const items = this.props.items.map((value, currentIx) => {
      const draggedIx = this.state.index
      const currentInDrag = currentIx === draggedIx

      let classes = [CLASSES.DRAGGABLE]
      let styles = { [this.keywords.start]: 0 }

      if (currentInDrag) {
        classes.push(CLASSES.IN_DRAG)
        styles[this.keywords.start] = this.state.offset

        if (this.state.drop) {
          classes.push(CLASSES.TRANSITION)
          styles = { ...styles, ...this.transitionStyles }
        }
      }

      else if (this.state.drag && !currentInDrag) {
        if (!this.props.disableTransitions) {
          classes.push(CLASSES.TRANSITION)
          styles = { ...styles, ...this.transitionStyles }
        }

        if (inRange(currentIx, draggedIx, draggedIx + this.state.step)) {
          styles[this.keywords.start] = this.state.step < 0
            ? this.itemDims[draggedIx][this.keywords.size]
            : -this.itemDims[draggedIx][this.keywords.size]
        }
      }

      const itemProps = {
        itemInDrag: currentInDrag && this.state.drag && !this.state.drop

      }

      return <this.itemComponent
        key={this.itemPos[currentIx]}

        style={styles}
        className={classes.join(' ')}

        addRef={this.addRef}
        handleDragStart={this.handleDragStart.bind(this, currentIx)}

        item={value}
        index={currentIx}
        first={currentIx === 0}
        last={currentIx === this.props.items.length - 1}

        listInDrag={!currentInDrag && this.state.drag && !this.state.drop}
        listInDrop={!currentInDrag && this.state.drop}
        itemInDrag={currentInDrag && this.state.drag && !this.state.drop}
        itemInDrop={currentInDrag && this.state.drop}
      />
    })

    return <Fragment>{items}</Fragment>
  }

  // Helper functions ----------------------------------------------------------

  addRef = (ref) => {
    this.itemRefs.push(ref)
  }

  getItemDims = () => {
    const { start, end, size } = this.keywords
    this.itemDims = this.itemPos.map(index => {
      const rect = this.itemRefs[index].getBoundingClientRect()
      return {
        [start]: rect[start],
        [end]: rect[end],
        [size]: rect[size],
        threshold: this.props.setSwapThreshold
          ? this.props.setSwapThreshold(rect[size])
          : rect[size]
      }
    })
  }

  getOffset = (event) => {
    const dragPosition = this.state.dragInput === 'MOUSE'
      ? event[this.keywords.inputPos]
      : event.touches[0][this.keywords.inputPos]

    return clamp(
      dragPosition - this.state.origin,
      this.state.offsetLimits.min,
      this.state.offsetLimits.max
    )
  }

  getOffsetLimits = (index) => {
    const { start, end, size } = this.keywords
    const rects = this.itemDims

    const overflowThreshold = this.props.setOverflowThreshold
      ? this.props.setOverflowThreshold(rects[index][size])
      : 0

    return {
      min: rects[0][start] - rects[index][start] - overflowThreshold,
      max: rects[this.props.items.length - 1][end] - rects[index][end] + overflowThreshold
    }
  }

  setDnDEventListeners = (listenerFunction) => {
    listenerFunction('mousemove', this.handleDrag)
    listenerFunction('touchmove', this.handleDrag)

    listenerFunction('mouseup', this.handleDrop)
    listenerFunction('scroll', this.handleDrop)
    listenerFunction('touchend', this.handleDrop)
    listenerFunction('touchcancel', this.handleDrop)
  }
}

export default List
