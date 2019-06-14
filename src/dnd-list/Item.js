import React from 'react'

export const createControlledItem = (Item) => {
  return class extends React.Component {
    constructor(props) {
      super(props)
      this.ref = React.createRef()
    }

    componentDidMount() {
      this.props.saveRef(this.ref.current)
    }

    handleDragStart = (event) => {
      this.props.handleDragStart(event.clientY)
    }

    render() {
      return (
        <Item
          {...this.props}
          domRef={this.ref}
          handleDrag={this.handleDragStart}
        />
      )
    }
  }
}