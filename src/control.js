import {getActionTypes} from './model'
import RTools from 'gfs-react-tools'
import './utils'
import extend from 'extend'

/**
 * 控制器
 * @class Control
 * */
const fetch = RTools.fetch
let controlList = {}

//任意类型参数
/**
 * 异步操作，Sync是一个装饰器（Decorator），用于装饰Control类中的方法，将原有的方法变成一个异步成功调用后执行结果方法，被装饰的方法需要返回数据或false，决定是否更新store刷新节点。
 * - 由Sync装饰后的方法，其作用域为Control，依然可以调用类中其他方法
 * - Sync参数error可以为Control中xxxError命名的方法替代，“xxx”命名规则必须与Sync装饰的方法名一致
 * - 被装饰后的方法在View中调用时传入的参数将已第二个为准，第一个参数将永远是异步执行后的结果
 * - 被装饰的方法名要和Model类中方法名对应
 * @method Sync
 * @param anywhere {object|string} 参数为一个字符串时，anywhere为url，当方法拥有2个参数，第一个参数作为url，第二个参数为object类型
 * @param anywhere.dataType {string} 数据返回类型 默认为json
 * @param anywhere.asyn  {boolean} 是否为异步请求，默认为true
 * @param anywhere.method {string} 数据请求方式，默认为GET，可选值有：POST、GET、OPTION、DEL、PUT
 * @param anywhere.timeout {number} 请求超时时间，可选填
 * @param anywhere.credentials {object} 跨域是是否要包含cookie值，可选值：include
 * @param anywhere.error {function} 请求失败回调，可选
 * @param anywhere.header {object} 包含的请求头，可选
 * @param anywhere.body {object} 需要传递给服务端的属性字段值，可选
 * @param anywhere.cache {boolean} 请求数据是否缓存
 * @return function
 * @example
 *      import {Sync,Control} from 'gfs-react-mvc'
 *
 *      class TestControl{
 *          constructor(){}
 *          //这里由于@为文档关键符号，所以下面将以$代替
 *          $Sync('/test',{
 *              method:'get'
 *          })
 *          save(data){
 *              //此处data是异步请求后服务器返回的结果
 *              if(data){
 *                  //返回数据更新页面节点信息
 *                  return data
 *              }
 *              //不做任何改变
 *              return false
 *          }
 *      }
 * */
export function Sync(anywhere){

    let url = ''
    let opts = {}
    let error = null
    //修正参数
    if(typeof(anywhere) === 'string' ){
        url = anywhere
    }else if(typeof(anywhere) ==='object' ){
        url = anywhere.url
        opts = anywhere
    }

    if(arguments.length>=2){
        opts = arguments[1]
    }
    //todo error作用域无法指向target，target对象丢失，强制制定为undefined，解决作用域丢失问题
    if(opts.error){
        error = opts.error
    }

    return function(target, name, descriptor){

        let fn = ((success = ()=>{})=>{
            let fn = success

            return function(){

                var args = Array.prototype.slice.call(arguments)
                var methodArg = args[args.length-1] || {}

                if(typeof(methodArg)==='object' && methodArg.url){
                    url = methodArg.url
                }

                return (dispatch)=>{
                    if(opts && typeof(opts.method) =='undefined' ){
                        opts.method = 'get'
                    }
                    if(url){
                        fetch(url,extend(opts,methodArg.url ||methodArg.body ?methodArg:{} ) ).then(function(){

                            let result = fn.apply(target,Array.prototype.slice.call(arguments).concat(args) )

                            if(result && typeof(result) === 'object'){

                                dispatch({
                                    type:result.type ? result.type : getActionTypes(`${target.__modelName}$$${name}`),
                                    data:result.data? result.data : result
                                } )
                            }
                        },error ||  target[name+'Error'] )
                    }else{
                        let result = fn.apply(target,args )
                        if(result && typeof(result) === 'object'){
                            dispatch({
                                type:result.type ? result.type : getActionTypes(`${target.__modelName}$$${name}`),
                                data:result.data? result.data : result
                            } )
                        }
                    }
                }
            }


        })(descriptor.value)

        descriptor.value = fn
        descriptor.enumerable = true
        return descriptor
    }
}
/**
 * 此方法是一个装饰器，只能用于类，被装饰后的类会变成对象列表（JSON）格式，主要目的是传递给组件使用，通过redux connect连接。
 * 被装饰的类将成为一个控制器，处理异步数据逻辑或业务逻辑，将数据传递给视图或服务器
 * @method Control
 * @param modelName {string} 实体类名字，全部小写，可以不加model后缀
 * @param loadingbar {Loadingbar} 废弃
 * @param mock {Mock} 废弃
 * @return object
 * @example
 *      import {Sync,Control} from 'gfs-react-mvc'
 *      //这里由于@为文档关键符号，所以下面将以$代替
 *      //@Control('testmodel')
 *      $Control('testmodel')
 *      class TestControl{
 *          constructor(){}
 *          //这里由于@为文档关键符号，所以下面将以$代替
 *          $Sync('/test',{
 *              method:'get'
 *          })
 *          save(data){
 *              //此处data是异步请求后服务器返回的结果
 *              if(data){
 *                  //返回数据更新页面节点信息
 *                  return data
 *              }
 *              //不做任何改变
 *              return false
 *          }
 *      }
 * */
export function Control(modelName,loadingbar,mock){

    if(arguments.length === 2 ){
        mock = loadingbar
        mock && (fetch.addMock(mock) )
    }

    if(arguments.length === 3){
        mock && (fetch.addMock(mock))
        loadingbar && (fetch.addLoadingBar(loadingbar) )
    }

    modelName = modelName && (modelName.toLowerCase().indexOf('model<=-1') ? modelName+'model':modelName).toLowerCase()

   return function(target){

       target.prototype.__modelName = modelName

       let control = controlList[modelName] = new target()
       //循环遍历方法，将返回
       //将方法的作用域改成对象本身
       var t = new target()
       var p ={}
       for(var item in t) {
           p[item] = t[item] instanceof Function ? t[item].bind(control ) : t[item]
       }

       return p
       //todo 解决对象私有属性访问，同样是对象丢失造成
       //return {...target.prototype}
   }
}

export function getControl(modelName){

    return controlList[modelName.toLowerCase() ]
}
