import ComparerFunc from '../util/compareFuncs';
import DoubleLLNode from './dllNode';

export default class DoubelLinkedList<T>{
    private compare:ComparerFunc<T>;
    private head:DoubleLLNode<T>|null;
    private tail:DoubleLLNode<T>|null;
    private length:number;

    constructor(compareFunc:any){
        this.head= null
        this.tail=null
        this.compare=new ComparerFunc<T>(compareFunc)
        this.length = 0;
    }

    public append(value:T):this{
        const newNode = new DoubleLLNode<T>(value);
        
        if(!this.head){
            this.head = this.tail = newNode
        }
        else if(this.tail){
            this.tail.next = newNode;
            this.tail=newNode;
        }
        this.length++;
        return this;
    }

    public prepend(value:T):this{
        const newNode = new DoubleLLNode<T>(value);
        this.head = newNode;

        if(!this.tail){
            this.tail = newNode
        }

        this.length++;
        return this;
    }

    public insert(value:T,indexTo:number):this{
        if(indexTo===0){
            this.prepend(value)
            this.length++
            return this
        }else if(indexTo>(this.length-1)){
            this.append(value)
            this.length++
            return this
        }else{
            let temp = 0;
            let curnode = this.head;
            const newNode = new DoubleLLNode(value);

            while(temp!==indexTo && curnode){
                curnode = curnode?.next;
                temp++;
            }
            if(curnode){
                newNode.next = curnode;
                newNode.prev = curnode.prev;
                if(curnode.prev){
                    curnode.prev.next = newNode;
                }else{
                    this.head = newNode;
                }
                curnode.prev = newNode
                this.length++;
                return this


            }
        }
        return this;
    }

    public getLength(){
        return this.length;
    }
    
    public delete(value:T):boolean{
        if(!this.head){
            return false
        }

        if(this.head.value===value){
            if(this.head.next){
                this.head.next.prev = null
                this.head = this.head.next;
            }else{
                this.head = null
                this.tail=null
            }
            if (this.length > 0) this.length--;
            return true
        }

        let curnode: DoubleLLNode<T> | null = this.head;
        while(curnode){
            if(curnode.value===value){
                if(!curnode.next){
                    this.tail = curnode.prev
                    if(this.tail){
                        this.tail.next = null;
                    }

                }else if ( curnode.prev){
                    curnode.prev.next=curnode.next;
                    curnode.next.prev=curnode.prev
                }
                if (this.length > 0) this.length--;
                return true
            }
            if(curnode.next) curnode = curnode.next
        }
        return false
    }

    public find({value,callback}:{value?:T,callback?:(val:T)=>boolean}):DoubleLLNode<T>|null{
        if(!this.head){
            return null
        }

        let curnode: DoubleLLNode<T>|null = this.head;
        while(curnode){
            if(callback && callback(curnode.value)){
                return curnode
            }

            if(value!==undefined && curnode.value === value){
                return curnode
            }
            curnode =curnode.next
        }
        return null
    }

    public deleteTail(): DoubleLLNode<T> | null{
        if(!this.head) return null

        let temp: DoubleLLNode<T> | null;

        if(this.head ===this.tail){
            temp = this.head
            this.tail=null
            this.head = null
            return temp
        }

        let curnode: DoubleLLNode<T>|null = this.head;

        while(curnode && curnode.next!=this.tail){
            curnode = curnode.next
        }

        if (curnode) { 
            temp = curnode.next
            curnode.next = null;
            this.tail = curnode;
        return temp

        }

        return null
    }

    public deleteHead(): DoubleLLNode<T> | null{
        if(!this.head) return null

        const temp: DoubleLLNode<T> | null=this.head

        if(this.head ===this.tail){
            this.tail=null
            this.head = null
        }else{
            this.head = this.head.next;
            this.head!.prev=null
        }
        return temp
    }

    public fromArray(values:Array<T>):this{
        values.forEach(each=>this.append(each))
        return this
    }

    public toArray(){
        const valuesList:DoubleLLNode<T>[]=[]

        let curnode = this.head;
        while(curnode){
            valuesList.push(curnode)
            curnode=curnode.next
        }

        return valuesList
    }

    public toString(callback?: (value: T) => string): string {
        return this.toArray().map(each => callback ? callback(each.value) : String(each)).join(", ");
    }
            
    public reverse(){
        if(!this.head) return null

        if(this.head===this.tail) return this

        let curnode = this.head;
        let prevnode:null|DoubleLLNode<T> = null;
        let nextnode:null|DoubleLLNode<T> = null;
        while(curnode){
            nextnode=curnode.next;
            prevnode = curnode.prev
            curnode.next = prevnode
            curnode.prev=nextnode
            if(nextnode)curnode=nextnode
        }

        this.tail=this.head
        this.head = prevnode

        return this
    }

    public clear(){
        this.head= null;
        this.tail= null;
        this.length=0;
        return this;
    }


}