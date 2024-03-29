/*
 * 变量命名规则说明
 *
 * 以`El`结尾：HTML元素
 * 以`Xel`结尾：XML剧情树中的元素
 */

"use strict"

/**
 * 输出容器
 * @type {HTMLElement}
 */
var mainEl = document.getElementById("main")
/**
 * 剧情树
 * @type {XMLDocument}
 */
var xml
/**
 * 需要存储的数据
 * @typedef {{
 *   epidemicRecord: number[],
 *   volumesUnlocked: boolean,
 *   restoreVolume: string,
 *   restoreData: number[],
 * }} Data
 * @type {Data}
 */
var data = {
  epidemicRecord: [],
  volumesUnlocked: false,
  restoreVolume: "",
  restoreData: [],
}
/**
 * 内嵌Js的变量“作用域”
 */
var vars = { data }
/**
 * 当前运行的`volume`
 * @type {Element}
 */
var volumeXel

try {
  Object.assign(
    data,
    JSON.parse(localStorage["soulSandboxLoveWithRichardData"])
  )
} catch (_) {
  console.info("恢复数据失败，已忽略\n", _)
}

/**
 * 可能是某种解密算法也说不定
 * @param {string} s
 */
function sts(s) {
  let r = ""
  for (let c of s) {
    let p = c.codePointAt(0)
    let t = p >> 1
    t |= t >> 16
    t |= t >> 2
    t |= t >> 8
    t |= t >> 1
    r += String.fromCodePoint(p ^ (t | t >> 4))
  }
  return r
}

// 请求剧情树
{
  clearMainEl()
  mainEl.innerHTML =
    "<p>正在加载数据……<span id='progress' role='status'>正在等待连接</span></p>"
  let progressEl = document.getElementById("progress")
  let xhr = new XMLHttpRequest()
  xhr.open("get", "lwr.min.xml.sts")
  xhr.overrideMimeType("text/plain; charset=UTF-8")
  xhr.onprogress = event => {
    let msg = `${(event.loaded / 1024).toFixed(1)}KB`
    if (event.lengthComputable) msg += ` / ${(event.total / 1024).toFixed(1)}KB`
    progressEl.textContent = msg
  }
  xhr.onload = () => {
    const str = sts(xhr.responseText)
    xml = new DOMParser().parseFromString(str, "application/xml")
    console.log(xml)
    init()
  }
  xhr.onerror = () => {
    mainEl.innerHTML = "<p>数据加载失败！</p>"
  }
  xhr.onloadend = () => {
    xhr.onload = null
    xhr.onerror = null
    xhr.onloadend = null
    xhr = null
  }
  xhr.send()
}

const volumeIds = ["epidemic", "senior", "sports"]
const volumeNames = [
  "Love with Richard under Epidemic",
  "Love with Richard to Senior",
  "Love with Richard: 9/30 Sports Meet",
]
function init() {
  mainEl.innerHTML = "<h1 lang=en>Love with Richard <small>3 in 1</small></h1>"
  const ulEl = mainEl.appendChild(document.createElement("ol"))
  for (let i = 0; i < volumeIds.length; ++i) {
    const volumeId = volumeIds[i],
      volumeName = volumeNames[i]
    const itemEl = ulEl
      .appendChild(document.createElement("li"))
      .appendChild(document.createElement("p"))
    const nameEl = itemEl.appendChild(document.createElement("cite"))
    nameEl.textContent = volumeName
    nameEl.setAttribute("lang", "en")
    itemEl.append(" ")
    const startEl = itemEl.appendChild(document.createElement("button"))
    startEl.className = "btn btn-sm btn-primary"
    startEl.textContent = "开始"
    startEl.disabled = i !== 0 && !data.volumesUnlocked
    startEl.onclick = () => {
      run(volumeId)
    }
    itemEl.append(" ")
    if (volumeId == data.restoreVolume) {
      itemEl.append(" ")
      const resumeEl = itemEl.appendChild(document.createElement("button"))
      resumeEl.className = "btn btn-sm btn-success"
      resumeEl.textContent = "继续上次"
      resumeEl.onclick = () => {
        run(volumeId, data.restoreData)
      }
    }
  }
}

/**
 * 清空`mainEl`的内容
 */
function clearMainEl() {
  mainEl.textContent = ""
}

/**
 * 运行剧情树的一个`volume`
 * @param {string} volumeId 要运行的`volume`的`id`
 * @param {number[]} restoreData 恢复之前进度
 */
async function run(volumeId, restoreData = []) {
  restoreData = restoreData.slice(0)
    console.log([...xml.lastChild.children])
  clearMainEl()

  try {
    data.restoreVolume = volumeId
    data.restoreData = restoreData
    volumeXel = xml.getElementById(volumeId)

    const titleXel = xml.evaluate("title", volumeXel).iterateNext()
    mainEl.appendChild(importContent(titleXel, "h1"))

    await iterate(volumeXel, mainEl)

    data.restoreVolume = ""
    data.restoreData = []
    save()

    init()
  } catch (err) {
    let errorEl = mainEl.appendChild(document.createElement("p"))
    errorEl.className = "voiceover"
    errorEl.textContent = "运行出错！" + err
    throw err
  }
}

/**
 * 运行剧情树的一个节点
 * @param {Element} xel
 */
async function iterate(xel, el) {
  var skipElseBlocks = false
  childLoop: for (let childXel of xel.children) {
    switch (childXel.nodeName) {
      case "p":
        el.appendChild(importContent(childXel, "p"))
        break
      case "h":
        el.appendChild(importContent(childXel, "h2"))
        break
      case "i": {
        let childEl = el.appendChild(importContent(childXel, "p"))
        childEl.className = "voiceover"
        break
      }
      case "a":
        await execJs(childXel.getAttribute("js"))
        break
      case "b": {
        let is = childXel.hasAttribute("is") ? childXel.getAttribute("is") : "div"
        let childEl = document.createElement(is)
        if (childXel.hasAttribute("lang"))
          childEl.setAttribute("lang", childXel.getAttribute("lang"))
        if (childXel.hasAttribute("class"))
          childEl.setAttribute("class", childXel.getAttribute("class"))
        if (childXel.hasAttribute("style"))
          childEl.setAttribute("style", childXel.getAttribute("style"))
        await iterate(childXel, el.appendChild(childEl))
        break
      }
      case "js":
        await execJs(childXel.textContent)
        break
      case "separator":
        el.appendChild(document.createElement("hr"))
        break
      case "pause":
        await pause()
        break
      case "choose":
        vars._ = await choose(childXel)
        break
      case "if":
        skipElseBlocks = false
        if (await execJs(childXel.getAttribute("js"))) {
          skipElseBlocks = true
          await iterate(childXel, el)
        }
        break
      case "elif":
        if (skipElseBlocks) break
        skipElseBlocks = false
        if (await execJs(childXel.getAttribute("js"))) {
          skipElseBlocks = true
          await iterate(childXel, el)
        }
        break
      case "else":
        if (!skipElseBlocks) await iterate(childXel, el)
        break
      case "case":
        for (let when of childXel.children) {
          if (
            when.nodeName === "else" ||
            (when.nodeName === "when" &&
              (await execJs(when.getAttribute("js"))))
          ) {
            await iterate(when, el)
            continue childLoop
          }
        }
        // 没有找到匹配的<when>，抛出错误
        console.error(
          "iterate(): <case>块中所有<when>都不匹配，<case>元素：\n",
          childXel
        )
        throw new Error("iterate(): <case>块中所有<when>都不匹配")
      case "call": {
        let targetId = childXel.getAttribute("target")
        let targetXel = xml.getElementById(targetId)
        if (targetXel) await iterate(targetXel, el)
        else console.log("iterate(): 已忽略不存在的子流程 " + targetId)
        break
      }
    }
  }
}

/**
 * 运行JavaScript代码片段
 * @param {string} js
 * @returns {*} 运行结果
 */
function execJs(js) {
  try {
    let result = new Function("$", "__js", `with ($) { return eval(__js) }`)(
      vars,
      js
    )
    return result
  } catch (err) {
    console.error(
      "execJs(): 捕获到错误，运行的代码：\n",
      js,
      "\nvars数据：\n",
      vars,
      "\n错误将再次抛出，错误信息应显示在下方。"
    )
    throw err
  }
}

/** `choose()` 当前互动选择题的序号（做唯一标识用） */
var chooseIndex = 1
/** 遍历`data.restoreData`的索引 */
var restoreIndex = 0
/**
 * 显示互动选择
 * @param {Element} xel 选项节点
 * @returns {Promise<number>} 所选选项索引
 */
function choose(xel) {
  /** 已选选项索引 */
  var chosenIndex = -1
  const choicesName = "choose" + chooseIndex++

  const chooseWrapEl = mainEl.appendChild(document.createElement("div"))
  chooseWrapEl.className = "card mb-3"
  const chooseEl = chooseWrapEl.appendChild(document.createElement("fieldset"))
  chooseEl.className = "choose card-body"

  const choicesEl = chooseEl.appendChild(document.createElement("div"))
  choicesEl.className = "choose-choices"

  var willRestore = restoreIndex < data.restoreData.length
  if (willRestore) {
    chosenIndex = data.restoreData[restoreIndex++]
    chooseEl.disabled = true
  }

  const radios = []
  ;[...xel.children].forEach((item, index) => {
    const itemId = `${choicesName}-choice${index}`
    const itemEl = choicesEl.appendChild(document.createElement("div"))
    itemEl.className = "form-check"
    const radio = itemEl.appendChild(document.createElement("input"))
    radio.type = "radio"
    radio.className = "form-check-input"
    radio.name = choicesName
    radio.id = itemId
    radio.checked = index === chosenIndex
    radio.onchange = function () {
      chosenIndex = index
      button.disabled = false
    }
    radios.push(radio)

    const label = itemEl.appendChild(importContent(item, "label"))
    label.className = "form-check-label"
    label.setAttribute("for", itemId)
    label.htmlFor = itemId
  })

  if (willRestore) return Promise.resolve(chosenIndex)

  const buttonWrapEl = chooseEl.appendChild(document.createElement("div"))
  buttonWrapEl.className = "buttonwrap"
  const button = buttonWrapEl.appendChild(document.createElement("button"))
  button.className = "btn btn-primary"
  button.disabled = true
  button.textContent = "确定"
  return new Promise(resolve => {
    button.onclick = function () {
      chooseEl.disabled = true
      buttonWrapEl.remove()
      data.restoreData.push(chosenIndex)
      restoreIndex++
      save()
      radios.forEach(radio => { radio.onchange = null })
      button.onclick = null
      resolve(chosenIndex)
    }
  })
}

/**
 * 显示“继续”按钮
 * @returns {Promise<void>}
 */
function pause() {
  mainEl.appendChild(document.createElement("hr"))

  if (restoreIndex < data.restoreData.length) {
    restoreIndex++
    return Promise.resolve()
  }

  const pauseEl = mainEl.appendChild(document.createElement("div"))
  pauseEl.className = "buttonwrap"
  const button = pauseEl.appendChild(document.createElement("button"))
  button.className = "btn btn-primary"
  button.textContent = "继续"
  return new Promise(resolve => {
    button.onclick = function () {
      pauseEl.remove()
      data.restoreData.push(0)
      restoreIndex++
      save()
      resolve()
    }
  })
}

/**
 * 保存`data`
 */
function save() {
  try {
    localStorage["soulSandboxLoveWithRichardData"] = JSON.stringify(data)
  } catch (_) {}
}

/**
 * 导入一个元素内的文本
 * @param {Element} xel
 * @param {string} elName
 */
function importContent(xel, elName) {
  var el = document.createElement(elName)
  if (xel.hasAttribute("lang"))
    el.setAttribute("lang", xel.getAttribute("lang"))
  if (xel.hasAttribute("class"))
    el.setAttribute("class", xel.getAttribute("class"))
  if (xel.hasAttribute("style"))
    el.setAttribute("style", xel.getAttribute("style"))
  for (let childXel of xel.childNodes) {
    if (childXel instanceof Text) el.appendChild(document.importNode(childXel))
    else if (childXel instanceof Element)
      el.appendChild(
        importContent(childXel, childXel.getAttribute("is") || "span")
      )
  }
  return el
}
