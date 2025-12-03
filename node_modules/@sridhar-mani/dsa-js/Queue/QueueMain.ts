import LinkedList from '../linkedList/llMain'

export default class QueueMain<T>{
    private linkedList: LinkedList<T>;

    constructor(){
        this.linkedList = new LinkedList();
    }

    public isEmpty(){
        return !(this.linkedList.getHead)
    }

    public peek(){
        if(!this.linkedList.getHead) return null

        return this.linkedList.getHead
    }

    public enqueue(value:T){
        this.linkedList.append(value)
    }

    public dequeue(){
        const removedHead = this.linkedList.deleteHead();
        return removedHead?removedHead:null
    }
    public toString(callback:(value:T)=>string){
        return this.linkedList.toString(callback)
    }
  
}
